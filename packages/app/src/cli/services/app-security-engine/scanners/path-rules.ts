import {findRepositoryMarker} from './repository-marker.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import ignore from 'ignore'

/**
 * A user-supplied .gitignore pattern relative to the app directory. Include
 * rules store the pattern without the leading `!`. `cli` rules come from the
 * `--ignore` flag; a future config-file source will join the same phase,
 * placed before the CLI rules so the command line keeps the final word.
 */
export interface PathOverride {
  action: 'exclude' | 'include'
  pattern: string
  source: 'cli'
}

/**
 * The scan's path rules, in three phases. The defaults and the git paths are
 * both exclusion-only and independent: either excludes a path. The overrides
 * win over both, and within the overrides the last matching rule wins, as in
 * .gitignore, so `!pattern` re-includes a default or git-ignored path.
 */
export interface PathRules {
  /** .gitignore exclude patterns applied to every scan. */
  defaults: ReadonlyArray<string>
  /** Literal paths relative to the app directory that git reports as untracked and ignored; directories end with `/`. */
  gitIgnoredPaths: ReadonlyArray<string>
  /** User-supplied rules, in precedence order (later wins). */
  overrides: ReadonlyArray<PathOverride>
}

/**
 * Decide whether a path relative to the app directory is excluded from the scan.
 *
 * `relativePath` must be POSIX-separated, relative to the app directory, with no
 * `./` prefix and no trailing slash. Pass `directory: true` for directories so
 * directory-only patterns (`build/`) can match them.
 *
 * PRECONDITION: the answer is only correct for paths whose ancestor directories
 * the caller has already confirmed are NOT excluded. A collapsed git directory
 * literal (`tmp/`) matches only the directory itself, never `tmp/a.ts`, so a
 * walker must prune the directory rather than ask about its contents. A
 * directory walker that never descends into excluded directories satisfies
 * this naturally; do not use the matcher to test arbitrary deep paths.
 */
type PathMatcher = (relativePath: string, options: {directory: boolean}) => boolean

/**
 * Decide whether a file path relative to the app directory is excluded from the scan,
 * checking its ancestor directories itself. See `createFilePathMatcher`.
 */
type FilePathMatcher = (relativePath: string) => boolean

/**
 * Paths never worth scanning: build output, dependencies, caches, and test
 * fixture trees, expressed in .gitignore syntax. A pattern without a slash
 * matches at any depth; a trailing `/` matches directories only.
 *
 * Patterns are generic on purpose. Earlier versions hardcoded the names of
 * this project's own fixture directories, which both leaked internal naming
 * into a tool that ships to third-party developers and silently skipped any
 * directory a developer happened to give the same name.
 *
 * The scan walks dot-folders, so generated dot-folders must be listed
 * explicitly: framework build output (`.next/`, `.nuxt/`, ...), caches
 * (`.cache/`, `.turbo/`), Yarn Berry's committed `.yarn/releases`, and the
 * CLI-generated `.shopify/`. `.github/`, `.vscode/`, `.devcontainer/` and
 * `.circleci/` are deliberately NOT excluded because hardcoded secrets turn up
 * in workflow and editor configuration.
 *
 * `.git` has no trailing slash so it also matches the `.git` FILE that git
 * worktrees use in place of a directory.
 *
 * Sub-apps (a nested directory with its own shopify.app.toml) are not a path
 * rule: `listRepositoryFiles` in `discover.ts` treats them as a structural
 * walker boundary, since that requires reading the tree rather than matching
 * a name.
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

/** What asking git for the app's ignored paths produced. */
export type GitIgnoreListing =
  | {status: 'listed'; paths: string[]}
  | {status: 'not-a-repository'}
  | {status: 'app-root-ignored'}
  | {status: 'failed'}

/**
 * Ask git which paths under `appRoot` are ignored and untracked.
 *
 * Listed paths are relative to `appRoot` with POSIX separators. A fully
 * ignored directory is collapsed to a single `dir/` entry. Only UNTRACKED
 * ignored paths appear: a tracked file that matches .gitignore is never
 * reported, so a committed-then-ignored `.env` is still scanned.
 *
 * Every outcome other than `listed` means "no git-based exclusions": the
 * caller scans everything the defaults allow. The outcomes are kept apart so
 * later findings can say exactly why a git-ignored file was still scanned.
 *
 * - `not-a-repository`: `appRoot` is not inside a git working tree: no `.git`
 *   marker exists at or above it, or `appRoot` lies inside the `.git`
 *   directory itself.
 * - `app-root-ignored`: an enclosing repository ignores the app folder (or an
 *   ancestor of it). That repository does not own the app, so its rules must
 *   not empty the scan.
 * - `failed`: git is missing, refused to read a repository that does exist
 *   (dubious ownership, corrupt or invalid configuration), or a command failed
 *   for any other reason.
 *
 * `pruneDefaultDirectories` lets git skip the default directories entirely
 * (see `defaultDirectoryPathspecExcludes`). Pass `false` whenever an override
 * could re-include one of them, so that git-ignored paths inside a re-included
 * directory are still reported and excluded.
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
  // One call answers two questions. Verified with git 2.55, the output is two lines: `true` or
  // `false`, then the app root's path relative to the repository's top level, which is an empty
  // line at the top level itself (`true\n\n`; `true\napps/web/\n` from apps/web). Inside `.git`
  // the first line is `false` with exit code 0; outside any repository the exit code is 128.
  const location = await runGit(appRoot, ['rev-parse', '--is-inside-work-tree', '--show-prefix'])
  if (location === undefined) return {status: 'failed'}
  // A repository git refuses to read (dubious ownership under `safe.directory`, a corrupt config or
  // HEAD) also exits 128, and only git's localized stderr tells the cases apart. The `.git` marker
  // on disk does so independently of locale: a marker means git failed on a repository that exists.
  if (location.exitCode !== 0) {
    return findRepositoryMarker(appRoot).status === 'none' ? {status: 'not-a-repository'} : {status: 'failed'}
  }
  const [insideWorkTree, prefix] = location.stdout.split(/\r?\n/)
  if (insideWorkTree === 'false') return {status: 'not-a-repository'}
  // A missing git binary resolves with exit code 0 and empty output (captureOutputWithExitCode
  // does not reject), so only an explicit `true` counts as being inside a working tree.
  if (insideWorkTree !== 'true' || prefix === undefined) return {status: 'failed'}

  // Is the app folder itself ignored by the repository? `--no-index` is essential: without it git
  // answers "not ignored" as soon as any descendant is force-tracked, and in exactly that case
  // `ls-files` below no longer collapses the app to a single `./` entry but lists every untracked
  // file in the app individually, which would exclude almost the entire app from the scan. With
  // `--no-index` the answer follows the ignore rules alone, for the app folder and its ancestors.
  //
  // The probe is skipped at the top level (empty prefix): a repository cannot ignore its own top
  // level, and `check-ignore .` normalises `.` there to the empty path, which a bare `*` pattern
  // matches, so a whitelist-style root .gitignore (`*` then `!src/` ...) would misreport the app
  // as ignored. From a subdirectory `.` is resolved to the prefix path, and the same whitelist
  // (`*`, `!*/`) correctly answers `1` (not ignored) for a re-included folder.
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
 * Keep git out of the default directories. `ls-files --others --ignored`
 * walks every untracked directory that is NOT itself ignored (an unignored
 * `node_modules/` with 63,000 files took 0.05 s to list here; 0.02 s with the
 * exclusion below). As long as no override can re-include a default directory, the
 * walker always prunes every one of them, so git's view of the ignored paths
 * inside one can never matter, and skipping them cannot change the scan.
 *
 * The moment ANY include override exists (`!web/build/`, or even `!keep.ts`)
 * the caller must turn the pruning off: a re-included default directory is
 * walked, and the git-ignored files inside it (`web/build/x.log` under
 * `*.log`) must then be excluded, which requires git to have reported them.
 * Pruning is disabled for every include override rather than only those that
 * name a default directory, because deciding whether an arbitrary pattern can
 * match a directory at some depth would re-implement gitignore matching; the
 * cost is only git walking directories it would otherwise skip.
 *
 * Each pathspec is `:(exclude,glob)` followed by the pattern wrapped in
 * leading and trailing `**` segments, which matches the directory at the app
 * root and at any depth; a wildcard name such as `*-fixtures/` keeps working.
 * Only directory defaults (trailing `/`) become pathspecs; file patterns such
 * as `*.test.*` and the `.git` entry do not name a directory git would
 * traverse.
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
    // Defensive only: captureOutputWithExitCode does not reject on a non-zero exit, and a missing git
    // binary resolves with empty output rather than throwing. Anything that does throw is treated
    // as a failed listing: no git-based exclusions.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

/**
 * Whether the value ends in an unescaped backslash. Each pair of backslashes is
 * one escaped backslash, so only an odd-length trailing run leaves one
 * unescaped. `ignore` silently drops a pattern that ends in a single backslash
 * and throws on three or more, because its own check only recognizes one.
 */
function endsWithUnescapedBackslash(value: string): boolean {
  const trailingBackslashCount = /\\+$/.exec(value)?.[0].length ?? 0
  return trailingBackslashCount % 2 === 1
}

/**
 * Whether `ignore` can compile the value. It turns each pattern into a regular
 * expression and throws a SyntaxError for some malformed ones, such as an
 * unclosed `[` followed by `/` (`src/[id/x.ts`) or an escaped backslash before
 * `(` (`a\\(b`). Asking the matcher itself catches every such pattern without
 * re-implementing its parser.
 */
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
 * Explain why a `--ignore` pattern is unusable, or return `undefined` when
 * it is a usable .gitignore line. Pure: callers (the flag parser) decide how
 * to surface the message.
 *
 * Each rejected value would otherwise silently do nothing, or worse: a comment
 * line (`#x`) and a blank line are no-ops in .gitignore syntax, a lone `!`
 * makes the `ignore` matcher re-include every path, a trailing unescaped
 * backslash makes `ignore` drop the pattern or throw, and a value with a line
 * break is added as one rule (the matcher only splits lines when given a single
 * string, not a list) that no path can ever match. A `..` segment can never
 * match either: walked paths are built from directory entry names below the app
 * directory, so none of them contains `..`. Last, any value `ignore` cannot
 * compile is rejected here rather than crashing the scan.
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

/**
 * Turn `--ignore` patterns into override rules, in command-line order. Each
 * value is one .gitignore line relative to the app directory: a leading `!`
 * makes an include rule; anything else is passed through unchanged as an
 * exclude rule, so gitignore escapes such as `\!` and `\#` keep their meaning.
 *
 * Values are validated by `ignorePatternProblem` at the flag boundary; a value
 * that still fails here is a programming error rather than user input.
 */
export function ignorePatternRules(ignorePatterns: ReadonlyArray<string>): PathOverride[] {
  return ignorePatterns.map((value) => {
    const problem = ignorePatternProblem(value)
    if (problem) throw new BugError(problem)
    return value.startsWith('!')
      ? {action: 'include', pattern: value.slice(1), source: 'cli'}
      : {action: 'exclude', pattern: value, source: 'cli'}
  })
}

/** Whether any override can re-include a path, which is what makes git's default-directory pruning unsafe. */
export function hasIncludeOverride(overrides: ReadonlyArray<PathOverride>): boolean {
  return overrides.some((override) => override.action === 'include')
}

/**
 * Assemble the scan's path rules. Precedence, lowest first: the hardcoded
 * defaults and the literal paths git reported as ignored (independent, either
 * excludes), then the overrides (`ignorePatternRules` for `--ignore`), so
 * users can exclude more paths or re-include defaults and git-ignored paths
 * with `!pattern`. A future config-file source belongs in the override phase
 * before the CLI rules, keeping the command line the final word.
 */
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
 * `ignorecase: false` matches the case-sensitive fast-glob discovery this
 * replaced and makes results identical on every platform.
 *
 * `allowRelativePaths: true` stops `ignore` from throwing on a name made only
 * of dots (`...` is a legal POSIX filename); callers already guarantee there is
 * no `./` prefix, which is the case the check exists for.
 *
 * `ignore` is a CommonJS module whose typings describe an ESM default export,
 * so under NodeNext the factory is reached through `.default` (as in
 * `dev/app-events/file-watcher.ts`).
 */
function compilePatterns(lines: ReadonlyArray<string>) {
  return ignore.default({ignorecase: false, allowRelativePaths: true}).add([...lines])
}

/**
 * Compile the rules into a matcher with .gitignore semantics: a path is
 * excluded if an ancestor directory is excluded, otherwise the LAST rule that
 * matches the path itself decides.
 *
 * Git literals (possibly thousands of them) are looked up in a Set rather than
 * compiled into patterns, both for speed and so that a name containing
 * gitignore-significant characters (`[id].ts`, `#hash.ts`) matches literally.
 * The pattern phases are compiled into two `ignore` instances: `combined`
 * (defaults then overrides, in order) and `overridesOnly`. Each lookup is:
 *
 *   1. an override matching the path itself decides (the last override wins);
 *   2. otherwise a git literal for the path excludes it;
 *   3. otherwise `combined` decides.
 *
 * This is exact under the PathMatcher precondition that every ancestor of the
 * queried path is included (the walker prunes excluded directories):
 * (a) `overridesOnly.test` then reports only the overrides' own match — had an
 *     override excluded an ancestor, the full rule set would have excluded it
 *     too, and the walker would never have asked. A parent's un-ignore does not
 *     propagate to children in `ignore`, so an `!dir/` override does not claim
 *     the files beneath it; they fall through to steps 2 and 3.
 * (b) Git literals only exclude, so leaving them out of `combined` can only
 *     include more; ancestors included under the full rule set stay included,
 *     so `combined.ignores` is the own match of defaults+overrides. When no
 *     override matched, that is the defaults' own match, which the git literal
 *     already had its chance to add to in step 2.
 * (c) A git directory literal (`tmp/`) matches only the directory. If an
 *     override re-includes `tmp/`, its files are then judged by the pattern
 *     phases alone, exactly as git treats a re-included directory. The flip
 *     side: git collapses a fully ignored directory to that single `logs/`
 *     literal, so an include override for one file inside it (`!logs/debug.log`)
 *     cannot re-include the file; the walker prunes the directory literal
 *     before ever asking about its contents. Users must re-include the
 *     directory itself (`!logs/`), after which the defaults and the other
 *     overrides judge everything beneath it.
 *
 * `combined` still applies git's parent-directory rule among pattern rules: a
 * file cannot be re-included once a parent directory is excluded, although a
 * directory itself can be re-included by a later `!dir/` override.
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
 * Compile the rules into a matcher for a FILE path the caller already knows
 * rather than reached by walking, such as an allowlisted configuration path.
 *
 * `createPathMatcher` is only correct once every ancestor directory is known
 * to be included, so this matcher establishes that itself: it asks about each
 * ancestor directory top-down first (an excluded ancestor excludes the file,
 * exactly as the walker would have pruned it), then about the file. The path
 * must meet `createPathMatcher`'s format: POSIX-separated, app-root-relative,
 * no `./` prefix and no trailing slash.
 *
 * This deliberately diverges from the walker for a symlinked directory. The
 * walker uses lstat semantics, so it tests a symlinked `.github` as a FILE
 * (`.github`); this matcher tests every ancestor as a directory (`.github/`).
 * A gitignored symlinked folder (reported by git as the file literal `.github`)
 * is therefore NOT excluded here, and its configuration surfaces as
 * unresolved instead, as documented on `findDependencyAutomationInputs`.
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
