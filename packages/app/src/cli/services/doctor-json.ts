import type {AppDoctorEngineMetadata, AppDoctorExecution, AppDoctorFindings} from './app-doctor-api.js'
import type {ReviewPack, ScanResult, TraceV2} from './app-doctor-engine/index.js'

type AppDoctorJsonResult =
  | {
      operation: 'scan'
      engine: AppDoctorEngineMetadata
      scan: ScanResult
      trace: TraceV2
      reviewPack: ReviewPack
    }
  | {
      operation: 'compile'
      engine: AppDoctorEngineMetadata
      scan: ScanResult
      trace: TraceV2
      findings: AppDoctorFindings
    }

export function toDoctorJson(execution: AppDoctorExecution): AppDoctorJsonResult {
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

export function encodeDoctorJson(result: AppDoctorJsonResult): string {
  return `${JSON.stringify(result, null, 2)}\n`
}
