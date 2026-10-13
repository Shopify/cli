import {findRepositoryMarker} from './repository-marker.js'
import {isMissingFilesystemEntry} from './filesystem-errors.js'
import {runGit} from './git.js'
import {matchGlob} from '@shopify/cli-kit/node/fs'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {basename, cwd, dirname, joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import {lstatSync, realpathSync} from 'node:fs'

export interface PathRules {
  /** `--exclude` globs, with their literal start resolved against the working directory. */
  excludePatterns: ReadonlyArray<string>
  /** Off with `--no-git-ignore`: Git isn't run for gathering and `.git` isn't skipped. */
  gitFiltering: boolean
  /** The real path of the working directory, which `--exclude` globs are relative to. */
  workingDirectory: string
}

export function createPathRules(options: {excludePatterns: ReadonlyArray<string>; noGitIgnore: boolean}): PathRules {
  const workingDirectory = realpathSync(cwd())
  return {
    // An empty pattern names nothing, but it would match the working directory, whose relative path is empty.
    excludePatterns: options.excludePatterns
      .filter((pattern) => pattern !== '')
      .map((pattern) => normalizeExcludePattern(pattern, workingDirectory)),
    gitFiltering: !options.noGitIgnore,
    workingDirectory,
  }
}

/** A segment with glob syntax, or an escape, ends the literal start of a pattern. */
const GLOB_SYNTAX = /[*?[\]{}()!#\\]/

/**
 * Paths are matched in their shortest form relative to the working directory, so a pattern's literal start is
 * resolved the same way: `./src`, `src/` and, from inside `app`, `../app/src` all become `src`, and `.` becomes the
 * working directory itself. The rest of the pattern is kept as typed.
 */
function normalizeExcludePattern(pattern: string, workingDirectory: string): string {
  const segments = pattern.split('/')
  const firstGlobSegment = segments.findIndex((segment) => GLOB_SYNTAX.test(segment))
  const literalSegments = firstGlobSegment === -1 ? segments : segments.slice(0, firstGlobSegment)
  const literalStart = literalSegments.join('/') || (pattern.startsWith('/') ? '/' : '')
  if (literalStart === '') return pattern

  const resolvedStart = relativePath(workingDirectory, resolvePath(workingDirectory, literalStart))
  const rest = segments.slice(literalSegments.length).join('/')
  if (rest === '') return resolvedStart
  return resolvedStart === '' ? rest : `${resolvedStart}/${rest}`
}

export type GitIgnoreListing = {status: 'listed'; paths: string[]} | {status: 'not-a-repository'} | {status: 'failed'}

/** How a scan directory's ignored paths were found; the last two mean gathering didn't use a listing. */
export type GatheredListingStatus = GitIgnoreListing['status'] | 'git-ignore-off' | 'tracked-only'

/** The untracked, ignored paths of one repository, relative to `directory` where its listing ran. */
export interface RepositoryIgnoredPaths {
  directory: string
  /** Directories end with `/`. */
  paths: ReadonlySet<string>
}

export function repositoryIgnoredPaths(
  directory: string,
  listing: GitIgnoreListing,
): RepositoryIgnoredPaths | undefined {
  return listing.status === 'listed' ? {directory, paths: new Set(listing.paths)} : undefined
}

/**
 * Whether the walker drops an entry (and, for a directory, everything inside it).
 * `repository` is the listing of the repository that owns the entry; without one, rule 2 can't apply.
 */
export function isDroppedEntry(
  rules: PathRules,
  repository: RepositoryIgnoredPaths | undefined,
  entry: {absolutePath: string; isDirectory: boolean},
): boolean {
  if (rules.gitFiltering) {
    if (basename(entry.absolutePath) === '.git') return true
    if (repository && isListedAsIgnored(repository, entry)) return true
  }
  return isExcluded(rules, entry.absolutePath)
}

/** For tracked paths, which are never dropped by the repository's ignore rules: only rules 1 and 3 apply. */
export function isDroppedTrackedPath(rules: PathRules, scanDirectory: string, trackedPath: string): boolean {
  const segments = trackedPath.split('/')
  return segments.some((segment, index) => {
    const absolutePath = joinPath(scanDirectory, ...segments.slice(0, index + 1))
    return (rules.gitFiltering && segment === '.git') || isExcluded(rules, absolutePath)
  })
}

/**
 * Whether `--exclude` removes a whole scan directory. The walker only tests the entries inside a scan directory, so the
 * directory itself and its ancestors up to the working directory are tested here: adding a directory can't undo an
 * exclusion.
 */
export function isExcludedScanDirectory(rules: PathRules, scanDirectory: string): boolean {
  const segments = relativePath(rules.workingDirectory, scanDirectory).split('/')
  return segments.some((_segment, index) =>
    isExcluded(rules, joinPath(rules.workingDirectory, ...segments.slice(0, index + 1))),
  )
}

function isListedAsIgnored(
  repository: RepositoryIgnoredPaths,
  entry: {absolutePath: string; isDirectory: boolean},
): boolean {
  const relative = relativePath(repository.directory, entry.absolutePath)
  return repository.paths.has(entry.isDirectory ? `${relative}/` : relative)
}

function isExcluded(rules: PathRules, absolutePath: string): boolean {
  if (rules.excludePatterns.length === 0) return false
  const relative = relativePath(rules.workingDirectory, absolutePath)
  return rules.excludePatterns.some((pattern) => matchGlob(relative, pattern))
}

/**
 * Only untracked paths are listed, so tracked files that match .gitignore are
 * still scanned. Any status other than `listed` means no listing-based exclusions apply.
 */
export async function listGitIgnoredPaths(directory: string): Promise<GitIgnoreListing> {
  const listing = await runGitIgnoreListing(directory)
  if (listing.status !== 'listed') outputDebug(`app security check: git ignore listing skipped (${listing.status})`)
  return listing
}

async function runGitIgnoreListing(directory: string): Promise<GitIgnoreListing> {
  const location = await runGit(directory, ['rev-parse', '--is-inside-work-tree'])
  if (location === undefined) return {status: 'failed'}
  // Git exits 128 both outside a repository and when it refuses one; the `.git` marker tells them
  // apart without parsing git's localized stderr.
  if (location.exitCode !== 0) {
    return findRepositoryMarker(directory).status === 'none' ? {status: 'not-a-repository'} : {status: 'failed'}
  }
  if (location.stdout.trim() === 'false') return {status: 'not-a-repository'}
  // A missing git binary resolves with exit code 0 and empty output.
  if (location.stdout.trim() !== 'true') return {status: 'failed'}

  const listed = await runGit(directory, [
    'ls-files',
    '-z',
    '--others',
    '--ignored',
    '--exclude-standard',
    '--directory',
    '--',
    '.',
  ])
  if (listed === undefined || listed.exitCode !== 0) return {status: 'failed'}
  return {status: 'listed', paths: splitNullSeparated(listed.stdout)}
}

/**
 * Asks the repository that contains the directory's parent, so a nested repository's top level is
 * judged by the outer repository. `--no-index` so a force-tracked file doesn't hide the ignore rule.
 */
export async function isIgnoredByParentRepository(directory: string): Promise<boolean> {
  const parent = dirname(directory)
  if (parent === directory) return false
  const result = await runGit(parent, ['check-ignore', '--no-index', '-q', '--', basename(directory)])
  return result?.exitCode === 0
}

/** The files Git tracks in the directory, relative to it. Undefined when Git can't list them. */
export async function listTrackedFiles(directory: string): Promise<string[] | undefined> {
  const listed = await runGit(directory, ['ls-files', '-z', '--cached', '--', '.'])
  if (listed === undefined || listed.exitCode !== 0) return undefined
  return splitNullSeparated(listed.stdout)
}

/**
 * The listing for a directory that is a repository's top level, or undefined when it isn't one.
 * A symbolic-linked `.git` is never followed, so that subtree has no listing-based exclusions.
 */
export async function listNestedRepository(directory: string): Promise<GitIgnoreListing | undefined> {
  try {
    const stats = lstatSync(joinPath(directory, '.git'))
    if (stats.isDirectory() || stats.isFile()) return await listGitIgnoredPaths(directory)
    return {status: 'failed'}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return isMissingFilesystemEntry(error) ? undefined : {status: 'failed'}
  }
}

function splitNullSeparated(output: string): string[] {
  return output.split('\0').filter((path) => path !== '')
}
