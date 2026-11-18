import {isParseFailure} from '../scanners/discover.js'
import {normalizeExcludePatterns} from '../scanners/path-rules.js'
import {matchGlob} from '@shopify/cli-kit/node/fs'
import {normalizePath} from '@shopify/cli-kit/node/path'
import type {PathOutsideRunLookup} from './suppressions.js'
import type {AgentFindingsDocument, CoverageExclusions, DeterministicFindingsDocument} from '../types.js'

/**
 * Whether the run of each source left a path out, as its results file records: the deterministic scan excluded it
 * (`--exclude`), couldn't read its file or list a directory that holds it, or scanned no directory that holds it; or
 * the agent's scope excluded it. Paths are relative to the app directory. The scan reads the selected app configuration
 * file whatever `--exclude` says and whatever the directories it scans or couldn't list, unless it couldn't read the
 * file itself. A file that was read but couldn't be parsed was scanned: each check that needs the parse is unresolved,
 * so its entries are not evaluated already, and the others, such as the secret check, read it.
 *
 * Exclude patterns are relative to the directory where `check` ran, which `coverage.exclusions` records. Deterministic
 * results written before it was recorded don't say, so their patterns are read as relative to the app directory, where
 * `check` usually runs. The agent's results don't record it either, but the agent copies its scope from the scan: when
 * its scope is the scan's, its patterns are matched as the scan matched them. The patterns of another scope have no
 * known base, so they exclude no path.
 */
export function pathOutsideRunLookup(sources: {
  deterministic: DeterministicFindingsDocument | null
  agent: AgentFindingsDocument | null
}): PathOutsideRunLookup {
  return (source, path) => {
    const coverage = sources.deterministic?.coverage
    if (!coverage) return false
    if (source === 'agent') {
      return sources.agent !== null && hasScanScope(sources.agent, coverage) && isExcludedFromScan(path, coverage)
    }
    const unreadPaths = coverage.files_skipped
      .filter((skipped) => !isParseFailure(skipped))
      .map((skipped) => normalizePath(skipped.path))
    if (path === coverage.app_config_file) return unreadPaths.includes(path)
    return (
      isExcludedFromScan(path, coverage) ||
      unreadPaths.some((unreadPath) => isInsideDirectory(path, unreadPath)) ||
      (coverage.scan_directories.length > 0 &&
        !coverage.scan_directories.some(({directory}) => isInsideDirectory(path, directory)))
    )
  }
}

/** The same scope block as the scan's, with the same values in the same order, as `review` compares them. */
function hasScanScope(agent: AgentFindingsDocument, coverage: DeterministicFindingsDocument['coverage']): boolean {
  return JSON.stringify(agent.scope) === JSON.stringify(coverage.scope)
}

function isExcludedFromScan(path: string, coverage: DeterministicFindingsDocument['coverage']): boolean {
  if (path === coverage.app_config_file) return false
  return isExcludedPath(path, coverage.exclusions ?? exclusionsFromAppDirectory(coverage.scope.excludes))
}

/**
 * The scan resolves the literal start of each pattern against the absolute working directory. A results file without
 * `coverage.exclusions` doesn't record it, so this path stands in for the app directory: `./src/` becomes `src`, and
 * `../web` stays outside the app.
 */
const APP_DIRECTORY_STAND_IN = '/shopify-app-security-app-directory'

/** The globs as typed, normalized as the scan normalizes them when `check` runs in the app directory. */
function exclusionsFromAppDirectory(excludePatterns: string[]): CoverageExclusions {
  return {
    patterns: normalizeExcludePatterns(excludePatterns, APP_DIRECTORY_STAND_IN),
    working_directory: '.',
    app_directory: '.',
  }
}

/**
 * Whether a pattern matches the path or one of the directories that hold it, as the scan excludes a whole directory.
 * The scan matches each of them in its shortest form relative to the working directory, with no trailing `/`, against
 * the patterns as it normalized them, so a pattern that ends with `/` excludes nothing.
 */
function isExcludedPath(path: string, exclusions: CoverageExclusions): boolean {
  const {patterns} = exclusions
  if (patterns.length === 0) return false
  const segments = pathFromWorkingDirectory(path, exclusions).split('/')
  return segments.some((_segment, index) => {
    const pathOrParent = segments.slice(0, index + 1).join('/')
    return patterns.some((pattern) => matchGlob(pathOrParent, pattern))
  })
}

/**
 * `path`, which is relative to the app directory, in its shortest form relative to the working directory. The two
 * directories meet at the deepest directory that holds both: below it, the working directory is the names of
 * `working_directory`, and the app directory the names of `app_directory`.
 */
function pathFromWorkingDirectory(path: string, exclusions: CoverageExclusions): string {
  const workingDirectoryNames = parseRelativePath(exclusions.working_directory).names
  const appDirectoryNames = parseRelativePath(exclusions.app_directory).names
  const file = parseRelativePath(path)
  const climbAboveBoth = file.climb - appDirectoryNames.length
  if (climbAboveBoth > 0) {
    return [...parentSegments(workingDirectoryNames.length + climbAboveBoth), ...file.names].join('/')
  }
  const names = [...appDirectoryNames.slice(0, appDirectoryNames.length - file.climb), ...file.names]
  const sharedCount = commonPrefixLength(workingDirectoryNames, names)
  return [...parentSegments(workingDirectoryNames.length - sharedCount), ...names.slice(sharedCount)].join('/')
}

/**
 * Both paths are relative to the app directory in their shortest form. So a scan directory that climbs to an ancestor
 * and then names a directory doesn't hold the app directory, and holds only paths that climb as far and then name the
 * same directories.
 */
function isInsideDirectory(path: string, scanDirectory: string): boolean {
  const directory = parseRelativePath(scanDirectory)
  const file = parseRelativePath(path)
  if (directory.names.length === 0) return file.climb <= directory.climb
  return file.climb === directory.climb && directory.names.every((name, index) => file.names[index] === name)
}

/** A relative path as the number of directories it climbs with its leading `..`, and the names below them. */
interface RelativePath {
  climb: number
  names: string[]
}

function parseRelativePath(path: string): RelativePath {
  const segments = withoutCurrentDirectory(normalizePath(path))
    .split('/')
    .filter((segment) => segment !== '')
  const firstName = segments.findIndex((segment) => segment !== '..')
  return firstName === -1 ? {climb: segments.length, names: []} : {climb: firstName, names: segments.slice(firstName)}
}

function parentSegments(count: number): string[] {
  return Array.from({length: count}, () => '..')
}

function commonPrefixLength(left: string[], right: string[]): number {
  const firstDifference = left.findIndex((name, index) => right[index] !== name)
  return firstDifference === -1 ? Math.min(left.length, right.length) : firstDifference
}

/** `./test/` and `test` name the same directory, and `.` names the app directory, which is the empty path. */
function withoutCurrentDirectory(path: string): string {
  const trimmed = path.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '')
  return trimmed === '.' ? '' : trimmed
}
