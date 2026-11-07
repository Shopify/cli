import {compareFindingLocations, compareStrings} from './order.js'
import {
  SEVERITY_RANK,
  type AgentFindingsDocument,
  type AnalysisMode,
  type CheckPrecedence,
  type DeterministicFindingsDocument,
  type FindingsDocument,
  type FindingsSource,
  type Severity,
  type StoredCheck,
  type StoredCheckStatus,
  type StoredFinding,
} from '../types.js'

/**
 * Combination of the two stored result files into one view (§5). Pure: no I/O and no catalog reads, so
 * check IDs aren't bounded by the current catalog and `review` never needs the catalog.
 */

export type FindingDisposition = 'active' | 'suppressed' | 'superseded'

export interface CombinedFinding extends StoredFinding {
  source: FindingsSource
  disposition: FindingDisposition
}

/** One source's own result for a check, kept next to the combined result. */
export interface SourceCheckResult {
  version: number
  status: StoredCheckStatus
  reason?: {code: string; message: string}
  analysis_mode?: AnalysisMode
  /** ISO time the source recorded the check. */
  generated_at: string
}

export interface CombinedCheck {
  id: string
  title: string
  severity: Severity
  description: string
  guide?: string
  /** The check's page on shopify.dev. Absent when the describing results file predates check docs pages. */
  docs_url?: string
  /** The agent snapshot's precedence, or 'union' when the agent didn't record the check. */
  precedence: CheckPrecedence
  /**
   * The precedence the combination used. It differs from `precedence` only when a `prefer-agent` agent
   * result is stale (older than the deterministic result), which falls back to 'union'.
   */
  applied_precedence: CheckPrecedence
  /** The combined status; each source's own status is in `by_source`. */
  status: StoredCheckStatus
  by_source: {deterministic: SourceCheckResult | null; agent: SourceCheckResult | null}
  findings: CombinedFinding[]
}

interface CombineFindingsInput {
  deterministic: DeterministicFindingsDocument | null
  agent: AgentFindingsDocument | null
}

/** Counts derived from combined checks. The first four partition the checks; the last two count findings. */
export interface CombinedChecksSummary {
  /** Checks with at least one active finding, whatever their status. */
  withFindings: number
  /** Executed checks with no active findings. */
  passed: number
  /** Not applicable checks with no active findings. */
  notApplicable: number
  /** Unresolved checks with no active findings. */
  unresolved: number
  suppressed: number
  superseded: number
}

const SOURCE_ORDER: Record<FindingsSource, number> = {deterministic: 0, agent: 1}

/** A stored check with the time its source recorded it. */
interface RecordedCheck {
  check: StoredCheck
  generatedAt: string
}

/** The stored checks recorded for one ID by each source. */
interface SourceChecks {
  deterministic: RecordedCheck | undefined
  agent: RecordedCheck | undefined
  /** The agent check whenever the agent recorded it, whatever the precedence; otherwise the deterministic one. */
  describingCheck: StoredCheck
}

/**
 * Combines the two stored result files into one check per ID (§5), following these rules:
 * - `precedence` is the agent snapshot's, defaulting to 'union'.
 * - The agent snapshot describes a check (title, severity, description, guide) whenever the agent recorded it.
 * - 'prefer-agent' applies only when the agent result is at least as new as the deterministic one, comparing the
 *   times each source recorded the check (`by_source.*.generated_at`, equal times count as current). A stale
 *   agent result, or an unparseable time on either side, falls back to 'union'; `applied_precedence` says which
 *   rule was used, and `isAgentResultStale` reports the fallback.
 * - Under 'prefer-agent' the agent result replaces the deterministic one: the agent's status stands and every
 *   deterministic finding is superseded. Under 'union' both sources' findings stay active and a pass from either
 *   source counts as a pass.
 * - Only the agent can suppress a finding (`isSuppressed`).
 */
export function combineFindings(input: CombineFindingsInput): CombinedCheck[] {
  return [...sourceChecksById(input)]
    .map(([id, checks]) => combineCheck(id, checks))
    .sort(
      (left, right) =>
        SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] || compareStrings(left.id, right.id),
    )
}

export function activeFindings(check: CombinedCheck): CombinedFinding[] {
  return check.findings.filter((finding) => finding.disposition === 'active')
}

export function isCheckPassed(check: CombinedCheck): boolean {
  return check.status === 'executed' && activeFindings(check).length === 0
}

/**
 * Whether a `prefer-agent` check fell back to union because the agent result is older than the deterministic
 * one. This is the only way `applied_precedence` can differ from `precedence`.
 */
export function isAgentResultStale(check: CombinedCheck): boolean {
  return check.applied_precedence !== check.precedence
}

/**
 * The one rule for the `suppression` combination input, used by the combination and by `review`'s
 * finding display, so both agree. Only the agent suppresses findings today; when suppression becomes uniform
 * across sources, only this function changes.
 */
export function isSuppressed(finding: StoredFinding, source: FindingsSource): boolean {
  return source === 'agent' && finding.suppression !== undefined
}

export function summarizeCombinedChecks(checks: CombinedCheck[]): CombinedChecksSummary {
  const summary: CombinedChecksSummary = {
    withFindings: 0,
    passed: 0,
    notApplicable: 0,
    unresolved: 0,
    suppressed: 0,
    superseded: 0,
  }
  for (const check of checks) {
    if (activeFindings(check).length > 0) {
      summary.withFindings += 1
    } else if (check.status === 'executed') {
      summary.passed += 1
    } else if (check.status === 'not_applicable') {
      summary.notApplicable += 1
    } else {
      summary.unresolved += 1
    }
    for (const finding of check.findings) {
      if (finding.disposition === 'suppressed') summary.suppressed += 1
      if (finding.disposition === 'superseded') summary.superseded += 1
    }
  }
  return summary
}

function sourceChecksById({deterministic, agent}: CombineFindingsInput): Map<string, SourceChecks> {
  const checksById = new Map<string, SourceChecks>()
  if (deterministic) {
    for (const check of deterministic.checks) {
      checksById.set(check.id, {
        deterministic: recordedCheck(check, deterministic),
        agent: undefined,
        describingCheck: check,
      })
    }
  }
  if (agent) {
    for (const check of agent.checks) {
      checksById.set(check.id, {
        deterministic: checksById.get(check.id)?.deterministic,
        agent: recordedCheck(check, agent),
        describingCheck: check,
      })
    }
  }
  return checksById
}

/**
 * The one rule for the time a source recorded a check, used when comparing the agent and deterministic
 * results. Today that is the document's `generated_at`; a per-check time on StoredCheck,
 * if one is added, would take precedence here (check time ?? document time) without changing callers.
 */
function checkGeneratedAt(_check: StoredCheck, document: Pick<FindingsDocument, 'generated_at'>): string {
  return document.generated_at
}

function recordedCheck(check: StoredCheck, document: Pick<FindingsDocument, 'generated_at'>): RecordedCheck {
  return {check, generatedAt: checkGeneratedAt(check, document)}
}

function combineCheck(id: string, {deterministic, agent, describingCheck}: SourceChecks): CombinedCheck {
  const precedence = agent?.check.snapshot.precedence ?? 'union'
  const {snapshot} = describingCheck
  const appliedPrecedence = applyPrecedence(precedence, deterministic, agent)
  // `applyPrecedence` only returns 'prefer-agent' with an agent check; the second test narrows the type.
  const agentReplacesDeterministic = appliedPrecedence === 'prefer-agent' && agent !== undefined

  const findings = [
    ...(deterministic?.check.findings ?? []).map((finding) =>
      combinedFinding(finding, 'deterministic', agentReplacesDeterministic ? 'superseded' : 'active'),
    ),
    ...(agent?.check.findings ?? []).map((finding) =>
      combinedFinding(finding, 'agent', isSuppressed(finding, 'agent') ? 'suppressed' : 'active'),
    ),
  ].sort(compareFindings)

  return {
    id,
    title: snapshot.title,
    severity: snapshot.severity,
    description: snapshot.description,
    ...(snapshot.guide ? {guide: snapshot.guide} : {}),
    ...(snapshot.docs_url ? {docs_url: snapshot.docs_url} : {}),
    precedence,
    applied_precedence: appliedPrecedence,
    status: agentReplacesDeterministic
      ? agent.check.status
      : unionStatus([deterministic, agent].flatMap((recorded) => (recorded ? [recorded.check.status] : []))),
    by_source: {
      deterministic: deterministic ? sourceCheckResult(deterministic) : null,
      agent: agent ? sourceCheckResult(agent) : null,
    },
    findings,
  }
}

/** 'prefer-agent' only when the agent recorded the check and its result isn't stale; otherwise 'union'. */
function applyPrecedence(
  precedence: CheckPrecedence,
  deterministic: RecordedCheck | undefined,
  agent: RecordedCheck | undefined,
): CheckPrecedence {
  if (precedence !== 'prefer-agent' || agent === undefined) return 'union'
  return isAgentResultCurrent(deterministic, agent) ? 'prefer-agent' : 'union'
}

/**
 * The agent result is current when the deterministic source didn't record the check, or when the agent recorded
 * it at the same time or later. An unparseable time on either side counts as stale.
 */
function isAgentResultCurrent(deterministic: RecordedCheck | undefined, agent: RecordedCheck): boolean {
  if (deterministic === undefined) return true
  const agentTime = Date.parse(agent.generatedAt)
  const deterministicTime = Date.parse(deterministic.generatedAt)
  if (Number.isNaN(agentTime) || Number.isNaN(deterministicTime)) return false
  return agentTime >= deterministicTime
}

/** A pass from either source counts as a pass; otherwise an unresolved source keeps the check unresolved. */
function unionStatus(statuses: StoredCheckStatus[]): StoredCheckStatus {
  if (statuses.includes('executed')) return 'executed'
  if (statuses.includes('unresolved')) return 'unresolved'
  return 'not_applicable'
}

function combinedFinding(
  finding: StoredFinding,
  source: FindingsSource,
  disposition: FindingDisposition,
): CombinedFinding {
  return {...finding, source, disposition}
}

function sourceCheckResult({check, generatedAt}: RecordedCheck): SourceCheckResult {
  return {
    version: check.version,
    status: check.status,
    ...(check.reason ? {reason: check.reason} : {}),
    ...(check.analysis_mode ? {analysis_mode: check.analysis_mode} : {}),
    generated_at: generatedAt,
  }
}

/** File, then line with a missing line first, then deterministic before agent, then message. */
function compareFindings(left: CombinedFinding, right: CombinedFinding): number {
  return (
    compareFindingLocations(left, right) ||
    SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source] ||
    compareStrings(left.message, right.message)
  )
}
