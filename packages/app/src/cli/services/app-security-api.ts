import {
  scanApp,
  SEVERITY_RANK,
  type AppSecurityEngineMetadata,
  type AppSecurityScan,
  type ScanInput,
  type Severity,
} from './app-security-engine/index.js'

export type {AppSecurityEngineMetadata}

export type AppSecurityBlockingLevel = Severity | 'none'

export type AppSecurityExecution = AppSecurityScan & {elapsedMilliseconds: number}

export function securityExitCode(execution: AppSecurityExecution, blocking: AppSecurityBlockingLevel): number {
  if (blocking === 'none') return 0
  const blocks = execution.scan.issues.some((issue) => SEVERITY_RANK[issue.severity] >= SEVERITY_RANK[blocking])
  return blocks ? 1 : 0
}

export async function executeAppSecurity({
  ignorePatterns,
  ...scanInput
}: ScanInput & {ignorePatterns?: ReadonlyArray<string>}): Promise<AppSecurityExecution> {
  const startTime = Date.now()
  const result = await scanApp(scanInput, {ignorePatterns})
  return {
    ...result,
    elapsedMilliseconds: Date.now() - startTime,
  }
}
