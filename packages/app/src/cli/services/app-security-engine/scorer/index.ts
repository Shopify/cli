import {getEngineVersion} from '../version.js'
import type {CheckExecution, CoverageGap, ScanMetadata, SkippedFile} from '../types.js'

export function computeScanMetadata(
  filesScanned: number,
  rulesRun: number,
  rulesSkipped: number,
  filesSkipped: SkippedFile[],
  checksExecuted: CheckExecution[],
  coverageGaps: CoverageGap[],
): ScanMetadata {
  return {
    timestamp: new Date().toISOString(),
    security_version: getEngineVersion(),
    files_scanned: filesScanned,
    rules_run: rulesRun,
    rules_skipped: rulesSkipped,
    files_skipped_count: filesSkipped.length,
    ...(filesSkipped.length > 0 ? {files_skipped: filesSkipped} : {}),
    coverage_gaps: coverageGaps,
    checks_executed: checksExecuted,
  }
}
