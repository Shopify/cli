import {
  listGatheredPaths,
  scanApp,
  SEVERITY_RANK,
  type AppSecurityScan,
  type CombinedCheck,
  type ScanInput,
  type ScanOptions,
  type Severity,
} from './app-security-engine/index.js'

export type AppSecurityBlockingLevel = Severity | 'none'

export type AppSecurityExecution = AppSecurityScan & {elapsedMilliseconds: number}

/**
 * The number of combined checks that fail `--blocking`, for `check` and `review` alike: the checks with an active
 * finding whose severity is at or above the level, whatever their status. Suppressed and superseded findings don't
 * count, and an unresolved check without active findings passes. Always 0 for `none`.
 */
export function blockedCheckCount(checks: CombinedCheck[], blocking: AppSecurityBlockingLevel): number {
  if (blocking === 'none') return 0
  return checks.filter(
    (check) =>
      SEVERITY_RANK[check.severity] >= SEVERITY_RANK[blocking] &&
      check.findings.some((finding) => finding.disposition === 'active'),
  ).length
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
