import type {AppSecurityEngineMetadata, AppSecurityExecution, AppSecurityFindings} from './app-security-api.js'
import type {ReviewPack, ScanResult, TraceV3} from './app-security-engine/index.js'

type AppSecurityJsonResult =
  | {
      operation: 'scan'
      engine: AppSecurityEngineMetadata
      scan: ScanResult
      trace: TraceV3
      reviewPack: ReviewPack
    }
  | {
      operation: 'compile'
      engine: AppSecurityEngineMetadata
      scan: ScanResult
      trace: TraceV3
      findings: AppSecurityFindings
    }

export function toSecurityJson(execution: AppSecurityExecution): AppSecurityJsonResult {
  if (execution.operation === 'scan') {
    return {
      operation: 'scan',
      engine: execution.engine,
      scan: execution.scan,
      trace: execution.trace,
      reviewPack: execution.reviewPack,
    }
  }

  return {
    operation: 'compile',
    engine: execution.engine,
    scan: execution.scan,
    trace: execution.trace,
    findings: execution.findings,
  }
}

export function encodeSecurityJson(result: AppSecurityJsonResult): string {
  return `${JSON.stringify(result, null, 2)}\n`
}
