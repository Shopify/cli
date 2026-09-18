/**
 * Merge findings by fingerprint and mark suppressions.
 *
 * A fingerprint binds a finding to its configuration, scope, check, and key but
 * not its mode, so a static and an agent observation of the same thing collide
 * here and become one interpreted finding with both observations retained.
 */
import type {
  AppDoctorAppliedSuppression,
  AppDoctorFindingScoring,
  AppDoctorInterpretedFinding,
  AppDoctorInterpretedSuppressions,
  AppDoctorResultMode,
} from './types.js'
import type {AppDoctorFinding, AppDoctorResult} from '../results/index.js'
import type {Suppression} from '../types.js'

export interface AppDoctorInterpretedFindings {
  readonly findings: ReadonlyArray<AppDoctorInterpretedFinding>
  readonly suppressions: AppDoctorInterpretedSuppressions
}

type Observations = AppDoctorInterpretedFinding['observations']

/**
 * Everything recorded for one fingerprint. `presented` is always set because an
 * entry is only created from an observation, so the merge never has to handle
 * an empty record.
 */
interface ObservedFinding {
  readonly scopeIdentity: string
  /** The observation whose fields are presented: static when present, else agent. */
  readonly presented: AppDoctorFinding
  readonly observations: Observations
}

const SEVERITY_RANK: Record<AppDoctorFinding['severity'], number> = {high: 3, medium: 2, low: 1}
const MODE_ORDER: ReadonlyArray<AppDoctorResultMode> = ['static', 'agent']

const highestSeverity = (
  presented: AppDoctorFinding,
  observations: ReadonlyArray<AppDoctorFinding>,
): AppDoctorFinding['severity'] =>
  observations.reduce(
    (highest, observation) =>
      SEVERITY_RANK[observation.severity] > SEVERITY_RANK[highest] ? observation.severity : highest,
    presented.severity,
  )

/**
 * Only deterministic, definite static evidence affects a grade. This mirrors
 * the legacy scorer's eligibility rule; agent observations never contribute.
 */
const scoringFor = (staticObservation: AppDoctorFinding | undefined): AppDoctorFindingScoring => {
  const eligible =
    staticObservation !== undefined &&
    (staticObservation.confidence === 'definite' || staticObservation.confidence === undefined)
  return {eligible, points: eligible ? staticObservation.points : 0}
}

const appliedSuppression = (suppression: Suppression): AppDoctorAppliedSuppression => ({
  id: suppression.id,
  justification: suppression.justification,
  provenance: suppression.provenance,
})

function observe(
  existing: ObservedFinding | undefined,
  result: AppDoctorResult,
  finding: AppDoctorFinding,
): ObservedFinding {
  if (existing === undefined) {
    return {scopeIdentity: result.scope_identity, presented: finding, observations: {[result.mode]: finding}}
  }
  return {
    ...existing,
    // Static presentation wins regardless of the order results arrive in.
    presented: result.mode === 'static' ? finding : existing.presented,
    observations: {...existing.observations, [result.mode]: finding},
  }
}

function collectObservations(results: ReadonlyArray<AppDoctorResult>): Map<string, ObservedFinding> {
  const observed = new Map<string, ObservedFinding>()
  for (const result of results) {
    for (const finding of result.findings) {
      observed.set(finding.fingerprint, observe(observed.get(finding.fingerprint), result, finding))
    }
  }
  return observed
}

function mergeObservations(
  fingerprint: string,
  {scopeIdentity, presented, observations}: ObservedFinding,
  suppression: Suppression | undefined,
): AppDoctorInterpretedFinding {
  const sources = MODE_ORDER.filter((mode) => observations[mode] !== undefined)
  return {
    fingerprint,
    scopeIdentity,
    code: presented.code,
    severity: highestSeverity(presented, Object.values(observations)),
    title: presented.title,
    message: presented.message,
    location: presented.location,
    ...(presented.snippet === undefined ? {} : {snippet: presented.snippet}),
    fix: presented.fix,
    evidence: presented.evidence,
    sources,
    observations,
    scoring: scoringFor(observations.static),
    suppressed: suppression !== undefined,
    ...(suppression === undefined ? {} : {suppression: appliedSuppression(suppression)}),
  }
}

const compareFindings = (left: AppDoctorInterpretedFinding, right: AppDoctorInterpretedFinding): number =>
  left.scopeIdentity.localeCompare(right.scopeIdentity) ||
  left.code.localeCompare(right.code) ||
  left.fingerprint.localeCompare(right.fingerprint)

/**
 * Merge every finding across `results` by fingerprint and apply suppressions.
 * Suppression hides presentation only; a suppressed finding keeps its scoring.
 */
export function interpretAppDoctorFindings(
  results: ReadonlyArray<AppDoctorResult>,
  suppressions: ReadonlyArray<Suppression>,
): AppDoctorInterpretedFindings {
  const observations = collectObservations(results)
  const matched = suppressions.filter((suppression) => observations.has(suppression.finding_fingerprint))
  const firstMatchByFingerprint = new Map<string, Suppression>()
  for (const suppression of matched) {
    if (!firstMatchByFingerprint.has(suppression.finding_fingerprint)) {
      firstMatchByFingerprint.set(suppression.finding_fingerprint, suppression)
    }
  }
  const findings = [...observations.entries()]
    .map(([fingerprint, observed]) =>
      mergeObservations(fingerprint, observed, firstMatchByFingerprint.get(fingerprint)),
    )
    .sort(compareFindings)
  return {
    findings,
    suppressions: {
      matched: matched.length,
      suppressedFindings: findings.filter((finding) => finding.suppressed).length,
      unmatched: suppressions.filter((suppression) => !observations.has(suppression.finding_fingerprint)),
    },
  }
}
