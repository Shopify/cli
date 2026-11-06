import {effectiveClientId, type AppSecuritySelection} from '../app-security-selection.js'
import {appSecuritySuppressionsPath} from '../app-security-artifacts.js'
import {resolvePath} from '@shopify/cli-kit/node/path'
// eslint-disable-next-line no-restricted-imports -- JSON file paths use native platform separators.
import {resolve} from 'node:path'
import type {
  AppSecurityApp,
  AppSecurityBlocking,
  AppSecurityInstructions,
  AppSecuritySavedSuppression,
  AppSecurityScanDirectory,
  AppSecurityScope,
  AppSecuritySuppressions,
} from './types.js'
import type {AppSecurityBlockingLevel} from '../app-security-api.js'
import type {
  AppSecurityScope as StoredAppSecurityScope,
  CombinedCheck,
  CoverageScanDirectory,
  SuppressionEntryResult,
  SuppressionEntryStatus,
} from '../app-security-engine/index.js'
import type {AppSecurityInstructionsDelivery} from '../app-security-instructions.js'
import type {SavedSuppression} from '../app-security-suppressions.js'

/**
 * The projections from the app security commands' data to the shared parts of their JSON output, in types.ts. Some
 * of that data has the stored results files' own format, from app-security-engine/results/schema.ts: the projections
 * convert it, so that format never appears in the public contract. A suppression kind keeps the spelling of
 * shopify.app-security.json, which people write.
 */

const SCAN_DIRECTORY_ORIGINS: Record<CoverageScanDirectory['origin'], AppSecurityScanDirectory['origin']> = {
  app_directory: 'app-directory',
  include_dir: 'include-dir',
  app_config_directory: 'app-config-directory',
}

/** CLI Kit joins paths with forward slashes, even on Windows. JSON output shows them absolute, with native separators. */
export function projectAppSecurityPath(path: string): string {
  return resolve(path)
}

/** Projects a path that is relative to the app directory, as results files record them. An absolute path stays as it is. */
export function projectAppSecurityRelativePath(appDirectory: string, path: string): string {
  return projectAppSecurityPath(resolvePath(appDirectory, path))
}

export function projectAppSecurityApp(selection: AppSecuritySelection): AppSecurityApp {
  return {
    directory: projectAppSecurityPath(selection.appDirectory),
    configurationPath: selection.kind === 'config' ? projectAppSecurityPath(selection.appConfigFilePath) : null,
    clientId: effectiveClientId(selection) ?? null,
  }
}

/** Projects delivered instructions: `delivery.copy` means that they're on the clipboard. */
export function projectAppSecurityInstructions(
  instructions: string,
  delivery: AppSecurityInstructionsDelivery,
): AppSecurityInstructions {
  return {content: instructions, copied: delivery.copy}
}

export function projectAppSecurityScope(scope: StoredAppSecurityScope): AppSecurityScope {
  return {includeDirs: scope.include_dirs, excludes: scope.excludes, noGitIgnore: scope.no_git_ignore}
}

/** Projects a scan directory, either absolute or relative to the app directory as results files record them. */
export function projectAppSecurityScanDirectory(
  appDirectory: string,
  scanDirectory: CoverageScanDirectory,
): AppSecurityScanDirectory {
  return {
    directory: projectAppSecurityRelativePath(appDirectory, scanDirectory.directory),
    origin: SCAN_DIRECTORY_ORIGINS[scanDirectory.origin],
  }
}

export function projectAppSecurityBlocking(blocking: {
  level: AppSecurityBlockingLevel
  blockedChecks: number
}): AppSecurityBlocking {
  return {level: blocking.level, blockedCheckCount: blocking.blockedChecks}
}

/**
 * Projects shopify.app-security.json and how its entries applied to `checks`, the combined checks that the entries
 * were applied to. A finding that both an entry and the agent suppress counts for the entry, which comes first.
 * `likelyFindingNumbers` gives the number of each stale entry's likely finding, by the entry's index, in `review`,
 * which numbers findings.
 */
export function projectAppSecuritySuppressions(
  appDirectory: string,
  suppressions: SuppressionEntryResult[],
  checks: CombinedCheck[],
  likelyFindingNumbers: ReadonlyMap<number, number> = new Map(),
): AppSecuritySuppressions {
  const suppressedFindings = checks
    .flatMap((check) => check.findings)
    .filter((finding) => finding.disposition === 'suppressed' && finding.suppressed_by?.origin === 'file')
  const countStatus = (status: SuppressionEntryStatus) =>
    suppressions.filter((result) => result.status === status).length
  return {
    filePath: projectAppSecurityPath(appSecuritySuppressionsPath(appDirectory)),
    entryCount: suppressions.length,
    suppressedFindingCount: suppressedFindings.length,
    staleEntryCount: countStatus('stale'),
    ambiguousEntryCount: countStatus('ambiguous'),
    entries: suppressions.map((result) => ({
      index: result.index,
      source: result.entry.source,
      check: result.entry.check,
      kind: result.entry.kind,
      path: projectAppSecurityRelativePath(appDirectory, result.entry.path),
      status: result.status,
      matchedFindingCount: result.matched_finding_count,
      likelyPath:
        result.likely_path === undefined ? null : projectAppSecurityRelativePath(appDirectory, result.likely_path),
      candidateFindingCount: result.candidate_locations?.length ?? null,
      likelyFinding:
        result.likely_finding === undefined
          ? null
          : {
              filePath: projectAppSecurityRelativePath(appDirectory, result.likely_finding.file),
              line: result.likely_finding.line,
              findingNumber: likelyFindingNumbers.get(result.index) ?? null,
            },
    })),
  }
}

/** Projects an entry that a command saved to shopify.app-security.json. */
export function projectAppSecuritySavedSuppression(
  appDirectory: string,
  {index, change, entry, previous}: SavedSuppression,
): AppSecuritySavedSuppression {
  return {
    index,
    change,
    source: entry.source,
    check: entry.check,
    kind: entry.kind,
    path: projectAppSecurityRelativePath(appDirectory, entry.path),
    code: entry.code ?? null,
    reason: entry.reason,
    configurations: entry.configurations,
    previous:
      previous === undefined ? null : {code: previous.code ?? null, kind: previous.kind, reason: previous.reason},
  }
}
