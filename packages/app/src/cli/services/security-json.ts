import type {AppSecurityEngineMetadata, AppSecurityExecution} from './app-security-api.js'
import type {ReviewPack, ScanResult, TraceV3} from './app-security-engine/index.js'

interface AppSecurityJsonResult {
  operation: 'scan'
  engine: AppSecurityEngineMetadata
  scan: ScanResult
  trace: TraceV3
  reviewPack: ReviewPack
}

export function toSecurityJson(execution: AppSecurityExecution): AppSecurityJsonResult {
  return {
    operation: 'scan',
    engine: execution.engine,
    scan: execution.scan,
    trace: execution.trace,
    reviewPack: execution.reviewPack,
  }
}

export function encodeSecurityJson(result: AppSecurityJsonResult): string {
  return `${JSON.stringify(result, null, 2)}\n`
}
