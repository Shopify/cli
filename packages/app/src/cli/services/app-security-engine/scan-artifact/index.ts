import {ENGINE_NAME, DETERMINISTIC_FINDINGS_SCHEMA_VERSION} from '../types.js'
import {redactText} from '../rules/secret-rules.js'
import type {
  CheckExecution,
  FindingEvidence,
  Issue,
  Location,
  DeterministicFindingsDocument,
  DeterministicCheckExecution,
  DeterministicFinding,
  ScanResult,
} from '../types.js'

const MAX_SECRET_INSPECTION_NODES = 500_000
const MAX_SECRET_INSPECTION_DEPTH = 100

const safeLocation = (location: Location): Location => ({
  file: redactText(location.file.replace(/\\/g, '/')),
  ...(location.line === undefined ? {} : {line: location.line}),
  ...(location.column === undefined ? {} : {column: location.column}),
})

const redactEvidence = (evidence: FindingEvidence[] | undefined): FindingEvidence[] =>
  (evidence ?? []).map((item) => ({
    location: safeLocation(item.location),
    ...(item.quote === undefined ? {} : {quote: redactText(item.quote)}),
  }))

export function redactIssue(issue: Issue): Issue {
  return {
    ...issue,
    id: redactText(issue.id),
    title: redactText(issue.title),
    message: redactText(issue.message),
    location: safeLocation(issue.location),
    ...(issue.snippet === undefined ? {} : {snippet: redactText(issue.snippet)}),
    ...(issue.detection_evidence === undefined ? {} : {detection_evidence: issue.detection_evidence.map(redactText)}),
    ...(issue.evidence === undefined ? {} : {evidence: redactEvidence(issue.evidence)}),
    fix: {
      ...issue.fix,
      description: redactText(issue.fix.description),
      ...(issue.fix.guide ? {guide: redactText(issue.fix.guide)} : {}),
    },
  }
}

function issueToFinding(issueInput: Issue): DeterministicFinding {
  const issue = redactIssue(issueInput)
  return {
    rule_id: issue.id,
    rule_version: issue.rule_version ?? 1,
    severity: issue.severity,
    title: issue.title,
    message: issue.message,
    location: issue.location,
    evidence: redactEvidence(issue.evidence),
    ...(issue.snippet === undefined ? {} : {snippet: issue.snippet}),
    fix: issue.fix,
  }
}

const findingSortKey = (finding: DeterministicFinding): string =>
  `${finding.rule_id}|${finding.location.file}|${String(finding.location.line ?? 0).padStart(10, '0')}|${finding.message}`

function sanitizeExecution(execution: CheckExecution): DeterministicCheckExecution {
  return {
    id: redactText(execution.id),
    version: execution.version,
    status: execution.status,
    applicable: execution.applicable,
    analysis_mode: execution.analysis_mode,
    findings: execution.findings,
    ...(execution.reason ? {reason: {...execution.reason, message: redactText(execution.reason.message)}} : {}),
  }
}

export interface BuildDeterministicFindingsOptions {
  engineVersion?: string
  ruleset?: string
  generatedAt?: string
}

/** Build deterministic-findings.json from a deterministic scan. Every free-form value is redacted. */
export function buildDeterministicFindings(
  result: ScanResult,
  options: BuildDeterministicFindingsOptions = {},
): DeterministicFindingsDocument {
  const findings = result.issues
    .map(issueToFinding)
    .sort((left, right) => findingSortKey(left).localeCompare(findingSortKey(right)))
  const checksExecuted = result.scan.checks_executed
    .map(sanitizeExecution)
    .sort((left, right) => left.id.localeCompare(right.id))
  return {
    schema_version: DETERMINISTIC_FINDINGS_SCHEMA_VERSION,
    engine: {
      name: ENGINE_NAME,
      version: redactText(options.engineVersion ?? result.version),
      ruleset: redactText(options.ruleset ?? `app-security-rules@${result.version}`),
    },
    generated_at: options.generatedAt ?? new Date().toISOString(),
    project: {
      commit: result.project.commit,
      dirty: result.project.dirty,
    },
    detection: {
      ...result.detection,
      languages: result.detection.languages.map((language) => ({
        ...language,
        files: language.files.map((path) => redactText(path)),
      })),
    },
    findings,
    checks_executed: checksExecuted,
    coverage: {
      files_scanned: result.scan.files_scanned,
      files_skipped: (result.scan.files_skipped ?? []).map((file) => ({
        ...file,
        path: redactText(file.path),
        ...(file.detail ? {detail: redactText(file.detail)} : {}),
      })),
      gaps: result.scan.coverage_gaps.map((gap) => ({
        ...gap,
        message: redactText(gap.message),
        ...(gap.file ? {file: redactText(gap.file)} : {}),
      })),
    },
  }
}

export type ParseDeterministicFindingsResult =
  | {ok: true; artifact: DeterministicFindingsDocument}
  | {ok: false; errors: string[]}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * Loosely identify a stored deterministic-findings.json. Only the schema version and the findings array are checked;
 * the artifact is informational, so its contents aren't validated further.
 */
export function parseDeterministicFindings(value: unknown): ParseDeterministicFindingsResult {
  if (!isObject(value)) return {ok: false, errors: ['deterministic findings must be a JSON object']}
  const errors: string[] = []
  if (value.schema_version !== DETERMINISTIC_FINDINGS_SCHEMA_VERSION)
    errors.push(
      `unsupported schema_version: ${String(value.schema_version)} (expected ${DETERMINISTIC_FINDINGS_SCHEMA_VERSION})`,
    )
  if (!Array.isArray(value.findings)) errors.push('findings must be an array')
  return errors.length === 0
    ? {ok: true, artifact: value as unknown as DeterministicFindingsDocument}
    : {ok: false, errors}
}

/**
 * Whether any string or object key in `value` still contains a secret that redaction would change.
 * Values too large or too deep to inspect completely count as containing a secret, so callers fail closed.
 */
export function containsUnredactedSecret(value: unknown): boolean {
  const stack: {value: unknown; depth: number}[] = [{value, depth: 0}]
  const seen = new WeakSet<object>()
  let visited = 0
  while (stack.length > 0) {
    const current = stack.pop()!
    visited += 1
    if (visited > MAX_SECRET_INSPECTION_NODES || current.depth > MAX_SECRET_INSPECTION_DEPTH) return true
    if (typeof current.value === 'string') {
      if (redactText(current.value) !== current.value) return true
      continue
    }
    if (current.value === null || typeof current.value !== 'object') continue
    if (seen.has(current.value)) continue
    seen.add(current.value)
    if (Array.isArray(current.value)) {
      for (const item of current.value) stack.push({value: item, depth: current.depth + 1})
      continue
    }
    for (const [key, child] of Object.entries(current.value)) {
      if (redactText(key) !== key) return true
      stack.push({value: child, depth: current.depth + 1})
    }
  }
  return false
}
