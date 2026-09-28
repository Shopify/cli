import {findRepositoryMarker} from './repository-marker.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import ignore from 'ignore'

/** The scan's path rules: two exclusion phases, either of which excludes a path. */
export interface PathRules {
  /** .gitignore exclude patterns applied to every scan. */
  defaults: ReadonlyArray<string>
  /** Literal app-root-relative paths git reports as untracked and ignored; directories end with `/`. */
  gitIgnoredPaths: ReadonlyArray<string>
}

/**
 * Decide whether an app-root-relative path is excluded from the scan.
 *
 * `relativePath` must be POSIX-separated, relative to the app root, with no
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
 * Decide whether an app-root-relative FILE path is excluded from the scan,
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
 */
export async function listGitIgnoredPaths(appRoot: string): Promise<GitIgnoreListing> {
  const listing = await runGitIgnoreListing(appRoot)
  if (listing.status !== 'listed') outputDebug(`App Security: git ignore listing skipped (${listing.status})`)
  return listing
}

async function runGitIgnoreListing(appRoot: string): Promise<GitIgnoreListing> {
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
    ...defaultDirectoryPathspecExcludes(),
  ])
  if (listed === undefined || listed.exitCode !== 0) return {status: 'failed'}
  return {status: 'listed', paths: listed.stdout.split('\0').filter((path) => path !== '')}
}

/**
 * Keep git out of the default directories. `ls-files --others --ignored`
 * walks every untracked directory that is NOT itself ignored (an unignored
 * `node_modules/` with 63,000 files took 0.05 s to list here; 0.02 s with the
 * exclusion below). Every default directory is always excluded by the walker,
 * so git's view of the ignored paths inside one can never matter, and skipping
 * them cannot change the scan.
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
 * Assemble the scan's path rules from the hardcoded defaults and the literal
 * paths git reported as ignored. The two phases are independent: a path is
 * excluded when either matches it.
 */
export function buildPathRules(input: {gitIgnoredPaths: ReadonlyArray<string>}): PathRules {
  return {defaults: DEFAULT_EXCLUDE_PATTERNS, gitIgnoredPaths: input.gitIgnoredPaths}
}

/**
 * Compile the rules into a matcher: a path is excluded when a git literal
 * names it exactly or a default pattern matches it.
 *
 * Git literals (possibly thousands of them) are looked up in a Set rather than
 * compiled into patterns, both for speed and so that a name containing
 * gitignore-significant characters (`[id].ts`, `#hash.ts`) matches literally.
 *
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
export function createPathMatcher(rules: PathRules): PathMatcher {
  const defaults = ignore.default({ignorecase: false, allowRelativePaths: true}).add([...rules.defaults])
  const gitIgnored = new Set(rules.gitIgnoredPaths)

  return (relativePath, {directory}) => {
    const key = directory ? `${relativePath}/` : relativePath
    return gitIgnored.has(key) || defaults.ignores(key)
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
