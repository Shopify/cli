/**
 * Score the interpreted findings, or withhold a score when the evidence cannot
 * support one.
 *
 * Eligibility and points are decided per interpreted finding (see
 * `findings.ts`); each fingerprint deducts exactly once because the fingerprint
 * is the finding's identity. Agent-only evidence never manufactures a grade,
 * and incomplete static coverage withholds one.
 */
import type {AppDoctorInterpretedCoverage, AppDoctorInterpretedFinding, AppDoctorInterpretedScore} from './types.js'
import type {Grade} from '../types.js'

const BASELINE = 100

// Copied from the legacy scorer (`scorer/index.ts`) so the two stay aligned without
// importing it: its evidence-key deduplication differs from fingerprint identity.
function scoreToGrade(score: number): Grade {
  if (score >= 90) return 'EXCELLENT'
  if (score >= 75) return 'GOOD'
  if (score >= 60) return 'NEEDS_WORK'
  return 'POOR'
}

/** Withholding reads the already-interpreted coverage (see `coverage.ts`) rather than re-deriving it. */
export function scoreAppDoctorInterpretation(
  coverage: AppDoctorInterpretedCoverage,
  findings: ReadonlyArray<AppDoctorInterpretedFinding>,
): AppDoctorInterpretedScore {
  if (coverage.staticResultCount === 0) return {status: 'withheld', reason: 'no_static_results'}
  if (!coverage.complete) return {status: 'withheld', reason: 'incomplete_static_coverage'}
  const deductions = findings
    .filter((finding) => finding.scoring.eligible)
    .reduce((sum, finding) => sum + finding.scoring.points, 0)
  const total = Math.max(0, Math.min(BASELINE, BASELINE + deductions))
  return {status: 'graded', total, baseline: BASELINE, grade: scoreToGrade(total)}
}
