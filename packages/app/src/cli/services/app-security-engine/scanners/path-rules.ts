import {findRepositoryMarker} from './repository-marker.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import ignore from 'ignore'

/** A user `--ignore` pattern. Include rules store the pattern without the leading `!`. */
export interface PathOverride {
  action: 'exclude' | 'include'
  pattern: string
  source: 'cli'
}

/** Overrides win over the defaults and git paths; among overrides the last match wins, as in .gitignore. */
export interface PathRules {
  defaults: ReadonlyArray<string>
  /** App-root-relative paths git reports as untracked and ignored; directories end with `/`. */
  gitIgnoredPaths: ReadonlyArray<string>
  overrides: ReadonlyArray<PathOverride>
}

/**
 * Only correct for paths whose ancestor directories are not excluded: a git
 * directory entry (`tmp/`) never matches `tmp/a.ts`, so callers must prune.
 */
type PathMatcher = (relativePath: string, options: {directory: boolean}) => boolean

type FilePathMatcher = (relativePath: string) => boolean

/**
 * `.git` has no trailing slash so it also matches the `.git` file used by
 * worktrees. `.github/`, `.vscode/` and similar are deliberately not excluded:
 * secrets turn up in workflow and editor configuration.
 */
export const DEFAULT_EXCLUDE_PATTERNS: ReadonlyArray<string> = [
  'node_modules/',
  'vendor/',
  '.git',
  '.next/',
  'coverage/',
  'dist/',
  'build/',
  '.shopify/',
  'test/',
  'tests/',
  'spec/',
  'specs/',
  '__tests__/',
  'fixtures/',
  '*-fixtures/',
  '__fixtures__/',
  '*.test.*',
  '*.spec.*',
  '.yarn/',
  '.react-router/',
  '.cache/',
  '.turbo/',
  '.vercel/',
  '.netlify/',
  '.output/',
  '.nuxt/',
  '.svelte-kit/',
]

export type GitIgnoreListing =
  | {status: 'listed'; paths: string[]}
  | {status: 'not-a-repository'}
  | {status: 'app-root-ignored'}
  | {status: 'failed'}

/**
 * Only untracked paths are listed, so tracked files that match .gitignore are
 * still scanned. Any status other than `listed` means no git exclusions apply.
 * Pass `pruneDefaultDirectories: false` whenever an override could re-include
 * a default directory.
 */
export async function listGitIgnoredPaths(
  appRoot: string,
  options: {pruneDefaultDirectories: boolean},
): Promise<GitIgnoreListing> {
  const listing = await runGitIgnoreListing(appRoot, options)
  if (listing.status !== 'listed') outputDebug(`App Security: git ignore listing skipped (${listing.status})`)
  return listing
}

async function runGitIgnoreListing(
  appRoot: string,
  options: {pruneDefaultDirectories: boolean},
): Promise<GitIgnoreListing> {
  // Prints `true` or `false`, then the app root's path below the top level (empty at the top level).
  const location = await runGit(appRoot, ['rev-parse', '--is-inside-work-tree', '--show-prefix'])
  if (location === undefined) return {status: 'failed'}
  // Git exits 128 both outside a repository and when it refuses one; the `.git` marker tells them
  // apart without parsing git's localized stderr.
  if (location.exitCode !== 0) {
    return findRepositoryMarker(appRoot).status === 'none' ? {status: 'not-a-repository'} : {status: 'failed'}
  }
  const [insideWorkTree, prefix] = location.stdout.split(/\r?\n/)
  if (insideWorkTree === 'false') return {status: 'not-a-repository'}
  // A missing git binary resolves with exit code 0 and empty output.
  if (insideWorkTree !== 'true' || prefix === undefined) return {status: 'failed'}

  // `--no-index` so a force-tracked file doesn't hide that the app folder is ignored. Skipped at
  // the top level, where `.` becomes the empty path and a whitelist-style `*` would match it.
  if (prefix !== '') {
    const appRootIgnored = await runGit(appRoot, ['check-ignore', '--no-index', '-q', '.'])
    if (appRootIgnored === undefined) return {status: 'failed'}
    if (appRootIgnored.exitCode === 0) return {status: 'app-root-ignored'}
    if (appRootIgnored.exitCode !== 1) return {status: 'failed'}
  }

  const listed = await runGit(appRoot, [
    'ls-files',
    '-z',
    '--others',
    '--ignored',
    '--exclude-standard',
    '--directory',
    '--',
    '.',
    ...(options.pruneDefaultDirectories ? defaultDirectoryPathspecExcludes() : []),
  ])
  if (listed === undefined || listed.exitCode !== 0) return {status: 'failed'}
  return {status: 'listed', paths: listed.stdout.split('\0').filter((path) => path !== '')}
}

/**
 * The walker prunes default directories unless an override re-includes one,
 * so git needn't walk them. Any include override disables this: telling whether
 * a pattern can match a default directory would re-implement gitignore.
 */
function defaultDirectoryPathspecExcludes(): string[] {
  return DEFAULT_EXCLUDE_PATTERNS.filter((pattern) => pattern.endsWith('/')).map(
    (pattern) => `:(exclude,glob)**/${pattern}**`,
  )
}

async function runGit(cwd: string, args: string[]): Promise<{exitCode: number; stdout: string} | undefined> {
  try {
    const result = await captureOutputWithExitCode('git', args, {cwd})
    return {exitCode: result.exitCode, stdout: result.stdout}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

/** `ignore` drops a pattern ending in one unescaped backslash and throws on three or more. */
function endsWithUnescapedBackslash(value: string): boolean {
  const trailingBackslashCount = /\\+$/.exec(value)?.[0].length ?? 0
  return trailingBackslashCount % 2 === 1
}

/** `ignore` throws a SyntaxError on some malformed patterns, such as `src/[id/x.ts`. */
function compilesAsPattern(value: string): boolean {
  try {
    compilePatterns([value])
    return true
  } catch (error) {
    if (error instanceof SyntaxError) return false
    throw error
  }
}

/**
 * Rejects values that would silently do nothing or break the scan: comments
 * and blank lines are no-ops, a lone `!` re-includes everything, a multi-line
 * value never matches, and walked paths never contain `..`.
 */
export function ignorePatternProblem(value: string): string | undefined {
  if (value.trim() === '') return "An --ignore pattern can't be empty."
  if (/[\r\n]/.test(value)) {
    return 'An --ignore pattern must be a single line. Repeat --ignore to add more than one pattern.'
  }
  if (value.startsWith('#')) {
    return `The --ignore pattern "${value}" starts with "#", which .gitignore treats as a comment. To match a path that starts with "#", escape it as "\\#".`
  }
  if (value.startsWith('!') && value.slice(1).trim() === '') {
    return `The --ignore pattern "${value}" has nothing after "!". Add the pattern to include again, for example "!build/".`
  }
  if (endsWithUnescapedBackslash(value)) {
    return `The --ignore pattern "${value}" ends with a backslash, which .gitignore treats as an incomplete escape. Use "/" as the path separator, or escape the backslash as "\\\\".`
  }
  const pattern = value.startsWith('!') ? value.slice(1) : value
  if (pattern.split('/').includes('..')) {
    return `The --ignore pattern "${value}" contains "..". Patterns are relative to the app directory and can't point outside it.`
  }
  if (!compilesAsPattern(value)) {
    return `The --ignore pattern "${value}" can't be read as a .gitignore pattern. Check for an unclosed "[" or a backslash before a special character.`
  }
  return undefined
}

/** Values are validated at the flag boundary, so a problem here is a bug. */
export function ignorePatternRules(ignorePatterns: ReadonlyArray<string>): PathOverride[] {
  return ignorePatterns.map((value) => {
    const problem = ignorePatternProblem(value)
    if (problem) throw new BugError(problem)
    return value.startsWith('!')
      ? {action: 'include', pattern: value.slice(1), source: 'cli'}
      : {action: 'exclude', pattern: value, source: 'cli'}
  })
}

export function hasIncludeOverride(overrides: ReadonlyArray<PathOverride>): boolean {
  return overrides.some((override) => override.action === 'include')
}

export function buildPathRules(input: {
  gitIgnoredPaths: ReadonlyArray<string>
  overrides?: ReadonlyArray<PathOverride>
}): PathRules {
  return {
    defaults: DEFAULT_EXCLUDE_PATTERNS,
    gitIgnoredPaths: input.gitIgnoredPaths,
    overrides: input.overrides ?? [],
  }
}

function toGitIgnoreLine(override: PathOverride): string {
  return override.action === 'include' ? `!${override.pattern}` : override.pattern
}

/**
 * `allowRelativePaths` stops `ignore` throwing on names made only of dots.
 * `ignore` is CommonJS, so under NodeNext the factory is on `.default`.
 */
function compilePatterns(lines: ReadonlyArray<string>) {
  return ignore.default({ignorecase: false, allowRelativePaths: true}).add([...lines])
}

/**
 * An override matching the path itself decides (the last one wins); otherwise
 * a git path excludes; otherwise the defaults and overrides together decide.
 * Git paths are a Set so names like `[id].ts` match literally. Git collapses a
 * fully ignored folder to `logs/`, so `!logs/debug.log` can't include a file
 * inside it; users must include `!logs/` instead.
 */
export function createPathMatcher(rules: PathRules): PathMatcher {
  const overrideLines = rules.overrides.map(toGitIgnoreLine)
  const combined = compilePatterns([...rules.defaults, ...overrideLines])
  const overridesOnly = compilePatterns(overrideLines)
  const gitIgnored = new Set(rules.gitIgnoredPaths)

  return (relativePath, {directory}) => {
    const key = directory ? `${relativePath}/` : relativePath
    const overrideMatch = overridesOnly.test(key)
    if (overrideMatch.ignored) return true
    if (overrideMatch.unignored) return false
    if (gitIgnored.has(key)) return true
    return combined.ignores(key)
  }
}

/**
 * For a file path not reached by walking: checks each ancestor directory
 * first, as the walker would have pruned it. Ancestors are tested as
 * directories, so a symlinked folder git lists as a file isn't excluded here.
 */
export function createFilePathMatcher(rules: PathRules): FilePathMatcher {
  const matcher = createPathMatcher(rules)
  return (relativePath) => {
    const segments = relativePath.split('/')
    for (let depth = 1; depth < segments.length; depth++) {
      if (matcher(segments.slice(0, depth).join('/'), {directory: true})) return true
    }
    return matcher(relativePath, {directory: false})
  }
}
