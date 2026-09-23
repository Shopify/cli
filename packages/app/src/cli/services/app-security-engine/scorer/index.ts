import {canonicalJson, sha256} from '../trace/index.js'
import {getEngineVersion} from '../version.js'
import type {CheckExecution, CoverageGap, Issue, ScanMetadata, SkippedFile} from '../types.js'

export function computeResultHash(issues: Issue[]): string {
  const canonicalIssues = issues
    .map((issue) => ({
      id: issue.id,
      source: issue.found_by ?? 'static',
      rule_version: issue.rule_version ?? (issue.found_by === 'agent' ? null : 1),
      check_version: issue.check_version ?? null,
      prompt_hash: issue.prompt_hash ?? null,
      severity: issue.severity,
      points: issue.points,
      title: issue.title,
      message: issue.message,
      location: issue.location,
      snippet: issue.snippet ?? null,
      evidence: issue.evidence ?? [],
      fix: issue.fix,
    }))
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)))
  return sha256({issues: canonicalIssues})
}

export function computeScanMetadata(
  filesScanned: number,
  rulesRun: number,
  rulesSkipped: number,
  issues: Issue[],
  fileHashMap: Record<string, string>,
  filesSkipped: SkippedFile[],
  checksExecuted: CheckExecution[],
  coverageGaps: CoverageGap[],
): ScanMetadata {
  const inputs = {
    files: Object.entries(fileHashMap).sort(([left], [right]) => left.localeCompare(right)),
    skipped: [...filesSkipped].sort((left, right) => left.path.localeCompare(right.path)),
  }
  return {
    timestamp: new Date().toISOString(),
    security_version: getEngineVersion(),
    files_scanned: filesScanned,
    rules_run: rulesRun,
    rules_skipped: rulesSkipped,
    files_skipped_count: filesSkipped.length,
    ...(filesSkipped.length > 0 ? {files_skipped: filesSkipped} : {}),
    coverage_complete: coverageGaps.length === 0,
    coverage_gaps: coverageGaps,
    input_hash: sha256(inputs),
    result_hash: computeResultHash(issues),
    file_hashes: fileHashMap,
    checks_executed: checksExecuted,
  }
}
