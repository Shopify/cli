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
 * Count confirmed deterministic findings that meet the blocking severity. Candidate-only checks are gated after
 * agent review by `shopify app security review --blocking`.
 */
export function blockedCheckCount(execution: AppSecurityExecution, blocking: AppSecurityBlockingLevel): number {
  if (blocking === 'none') return 0
  const blockingIssues = execution.scan.issues.filter(
    (issue) => issue.confidence !== 'needs_review' && SEVERITY_RANK[issue.severity] >= SEVERITY_RANK[blocking],
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
