import {findRepositoryMarker} from './repository-marker.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import ignore from 'ignore'

export interface PathRules {
  defaults: ReadonlyArray<string>
  /** App-root-relative paths git reports as untracked and ignored; directories end with `/`. */
  gitIgnoredPaths: ReadonlyArray<string>
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
 */
export async function listGitIgnoredPaths(appRoot: string): Promise<GitIgnoreListing> {
  const listing = await runGitIgnoreListing(appRoot)
  if (listing.status !== 'listed') outputDebug(`App Security: git ignore listing skipped (${listing.status})`)
  return listing
}

async function runGitIgnoreListing(appRoot: string): Promise<GitIgnoreListing> {
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
    ...defaultDirectoryPathspecExcludes(),
  ])
  if (listed === undefined || listed.exitCode !== 0) return {status: 'failed'}
  return {status: 'listed', paths: listed.stdout.split('\0').filter((path) => path !== '')}
}

/** The walker always prunes default directories, so stop git walking an unignored `node_modules/`. */
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

export function buildPathRules(input: {gitIgnoredPaths: ReadonlyArray<string>}): PathRules {
  return {defaults: DEFAULT_EXCLUDE_PATTERNS, gitIgnoredPaths: input.gitIgnoredPaths}
}

/**
 * Git paths are looked up in a Set so names like `[id].ts` match literally.
 * `allowRelativePaths` stops `ignore` throwing on names made only of dots.
 * `ignore` is CommonJS, so under NodeNext the factory is on `.default`.
 */
export function createPathMatcher(rules: PathRules): PathMatcher {
  const defaults = ignore.default({ignorecase: false, allowRelativePaths: true}).add([...rules.defaults])
  const gitIgnored = new Set(rules.gitIgnoredPaths)

  return (relativePath, {directory}) => {
    const key = directory ? `${relativePath}/` : relativePath
    return gitIgnored.has(key) || defaults.ignores(key)
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
