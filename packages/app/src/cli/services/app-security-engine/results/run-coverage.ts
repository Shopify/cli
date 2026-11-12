import {matchGlob} from '@shopify/cli-kit/node/fs'
import {normalizePath} from '@shopify/cli-kit/node/path'
import type {PathOutsideRunLookup} from './suppressions.js'
import type {AgentFindingsDocument, DeterministicFindingsDocument} from '../types.js'

/**
 * Whether the run of each source left a path out, as its results file records: the deterministic scan excluded it
 * (`--exclude`), skipped its file, or scanned no directory that holds it; or the agent's scope excluded it. Paths are
 * relative to the app directory. Exclude patterns are relative to the directory where `check` ran, which the results
 * don't hold, so they are read as relative to the app directory, where `check` usually runs.
 */
export function pathOutsideRunLookup(sources: {
  deterministic: DeterministicFindingsDocument | null
  agent: AgentFindingsDocument | null
}): PathOutsideRunLookup {
  return (source, path) => {
    if (source === 'agent') return sources.agent !== null && isExcludedPath(path, sources.agent.scope.excludes)
    const coverage = sources.deterministic?.coverage
    if (!coverage) return false
    return (
      isExcludedPath(path, coverage.scope.excludes) ||
      coverage.files_skipped.some((skipped) => normalizePath(skipped.path) === path) ||
      (coverage.scan_directories.length > 0 &&
        !coverage.scan_directories.some(({directory}) => isInsideDirectory(path, directory)))
    )
  }
}

/** Whether a pattern matches the path or one of the directories that hold it, as the scan excludes a whole directory. */
function isExcludedPath(path: string, excludePatterns: string[]): boolean {
  const patterns = excludePatterns.map(withoutCurrentDirectory).filter((pattern) => pattern !== '')
  if (patterns.length === 0) return false
  const segments = path.split('/')
  return segments.some((_segment, index) => {
    const pathOrParent = segments.slice(0, index + 1).join('/')
    return patterns.some((pattern) => matchGlob(pathOrParent, pattern))
  })
}

function isInsideDirectory(path: string, scanDirectory: string): boolean {
  const directory = withoutCurrentDirectory(normalizePath(scanDirectory))
  if (directory === '') return !path.startsWith('../')
  return path.startsWith(`${directory}/`)
}

/** `./test/` and `test` name the same directory, and `.` names the app directory, which is the empty path. */
function withoutCurrentDirectory(path: string): string {
  const trimmed = path.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '')
  return trimmed === '.' ? '' : trimmed
}
