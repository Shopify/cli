import {
  listGatheredPaths,
  scanApp,
  SEVERITY_RANK,
  type AppSecurityScan,
  type ScanInput,
  type ScanOptions,
  type Severity,
} from './app-security-engine/index.js'

export type AppSecurityBlockingLevel = Severity | 'none'

export type AppSecurityExecution = AppSecurityScan & {elapsedMilliseconds: number}

/**
 * The number of checks that fail `--blocking`: the checks with a deterministic issue whose own severity is at or above
 * the level. Always 0 for `none`.
 */
export function blockedCheckCount(execution: AppSecurityExecution, blocking: AppSecurityBlockingLevel): number {
  if (blocking === 'none') return 0
  const blockingIssues = execution.scan.issues.filter(
    (issue) => SEVERITY_RANK[issue.severity] >= SEVERITY_RANK[blocking],
  )
  return new Set(blockingIssues.map((issue) => issue.id)).size
}

export async function executeAppSecurity({
  includeDirs,
  excludePatterns,
  noGitIgnore,
  ...scanInput
}: ScanInput & ScanOptions): Promise<AppSecurityExecution> {
  const startTime = Date.now()
  const result = await scanApp(scanInput, {includeDirs, excludePatterns, noGitIgnore})
  return {
    ...result,
    elapsedMilliseconds: Date.now() - startTime,
  }
}

/** Gathers the paths a scan would walk, without reading any file or running any check. */
export function listAppSecurityFiles({
  includeDirs,
  excludePatterns,
  noGitIgnore,
  ...scanInput
}: ScanInput & ScanOptions): ReturnType<typeof listGatheredPaths> {
  return listGatheredPaths(scanInput, {includeDirs, excludePatterns, noGitIgnore})
}
