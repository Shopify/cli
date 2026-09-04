import {canonicalJson, sha256} from '../trace/index.js'
import {getEngineVersion} from '../version.js'
import type {CheckExecution, CoverageGap, Issue, ScoreResult, Grade, ScanMetadata, SkippedFile} from '../types.js'

const BASELINE = 100

/** Only deterministic, definite evidence can affect a grade. */
export function calculateScore(issues: Issue[]): ScoreResult {
  let total = BASELINE
  const deductedEvidence = new Set<string>()

  for (const issue of issues) {
    if (issue.found_by === 'agent' || issue.found_by === 'external') continue
    if (issue.confidence !== 'definite' && issue.confidence !== undefined) continue
    const evidenceKey = canonicalJson({
      id: issue.id,
      location: issue.location,
      evidence: issue.evidence ?? [],
    })
    if (deductedEvidence.has(evidenceKey)) continue
    deductedEvidence.add(evidenceKey)
    total += issue.points
  }

  total = Math.max(0, Math.min(100, total))
  return {total, baseline: BASELINE, grade: scoreToGrade(total)}
}

function scoreToGrade(score: number): Grade {
  if (score >= 90) return 'EXCELLENT'
  if (score >= 75) return 'GOOD'
  if (score >= 60) return 'NEEDS_WORK'
  return 'POOR'
}

export function computeResultHash(issues: Issue[], score: ScoreResult | null): string {
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
  return sha256({issues: canonicalIssues, score})
}

export function computeScanMetadata(
  filesScanned: number,
  rulesRun: number,
  rulesSkipped: number,
  issues: Issue[],
  score: ScoreResult | null,
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
    doctor_version: getEngineVersion(),
    files_scanned: filesScanned,
    rules_run: rulesRun,
    rules_skipped: rulesSkipped,
    files_skipped_count: filesSkipped.length,
    ...(filesSkipped.length > 0 ? {files_skipped: filesSkipped} : {}),
    coverage_complete: coverageGaps.length === 0,
    coverage_gaps: coverageGaps,
    input_hash: sha256(inputs),
    result_hash: computeResultHash(issues, score),
    file_hashes: fileHashMap,
    checks_executed: checksExecuted,
  }
}
