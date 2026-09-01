import {ENGINE_NAME, SUPPORTED_TRACE_SCHEMA_VERSIONS, TRACE_SCHEMA_VERSION} from '../types.js'
import {loadChecks} from '../checks/index.js'
import {redactText} from '../rules/secret-rules.js'
import {createHash} from 'node:crypto'
import type {
  AnalysisMode,
  CheckExecution,
  CheckExecutionStatus,
  FindingEvidence,
  Issue,
  Location,
  ScanResult,
  Severity,
  Suppression,
  TraceFinding,
  TraceV2,
} from '../types.js'

const SHA256 = /^sha256:[0-9a-f]{64}$/
const MAX_TRACE_VALIDATION_NODES = 500_000
const MAX_TRACE_VALIDATION_DEPTH = 100
const TRACE_COMPLEXITY_ERROR = 'trace is cyclic or exceeds validation complexity limits'
const SEVERITIES = new Set<Severity>(['high', 'medium', 'low'])
const EXECUTION_STATUSES = new Set<CheckExecutionStatus>([
  'executed',
  'not_applicable',
  'unsupported_framework',
  'unresolved',
])
const ANALYSIS_MODES = new Set<AnalysisMode>(['regex', 'structured_config', 'audit', 'ast', 'agent', 'external'])
const REASON_CODES = new Set([
  'capability_absent',
  'no_relevant_files',
  'unsupported_framework',
  'unsupported_language',
  'parser_unavailable',
  'audit_unavailable',
  'agent_investigation_required',
  'not_reported',
  'input_rejected',
])
const FRAMEWORKS = new Set(['react_router', 'none', 'unknown', 'mixed'])
const SURFACES = new Set(['react_router', 'theme_app_extension', 'config_only', 'unknown', 'mixed'])

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256(value: unknown): string {
  const input = typeof value === 'string' ? value : canonicalJson(value)
  return `sha256:${createHash('sha256').update(input).digest('hex')}`
}

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
    ...(issue.agent_reasoning === undefined ? {} : {agent_reasoning: redactText(issue.agent_reasoning)}),
    ...(issue.detection_evidence === undefined ? {} : {detection_evidence: issue.detection_evidence.map(redactText)}),
    ...(issue.evidence === undefined ? {} : {evidence: redactEvidence(issue.evidence)}),
    fix: {
      ...issue.fix,
      description: redactText(issue.fix.description),
      ...(issue.fix.guide ? {guide: redactText(issue.fix.guide)} : {}),
    },
  }
}

const findingFingerprintPayload = (finding: Omit<TraceFinding, 'fingerprint' | 'suppression' | 'suppressed'>) => ({
  source: finding.source,
  rule_id: finding.rule_id ?? null,
  rule_version: finding.rule_version ?? null,
  check_id: finding.check_id ?? null,
  check_version: finding.check_version ?? null,
  prompt_hash: finding.prompt_hash ?? null,
  severity: finding.severity,
  title: finding.title,
  location: finding.location,
  message: finding.message,
  evidence: finding.evidence,
  snippet: finding.snippet ?? null,
  fix: finding.fix,
})

export function findingFingerprint(finding: Omit<TraceFinding, 'fingerprint' | 'suppression' | 'suppressed'>): string {
  return sha256(findingFingerprintPayload(finding))
}

function issueSource(issue: Issue): TraceFinding['source'] {
  if (issue.found_by === 'agent') return 'agent'
  if (issue.found_by === 'external') return 'external'
  return 'deterministic'
}

function issueToFinding(issueInput: Issue): TraceFinding {
  const issue = redactIssue(issueInput)
  const source = issueSource(issue)
  const core: Omit<TraceFinding, 'fingerprint' | 'suppression' | 'suppressed'> = {
    source,
    ...(source === 'agent'
      ? {check_id: issue.id, check_version: issue.check_version, prompt_hash: issue.prompt_hash}
      : {rule_id: issue.id, rule_version: issue.rule_version ?? 1}),
    severity: issue.severity,
    title: issue.title,
    message: issue.message,
    location: issue.location,
    evidence: redactEvidence(issue.evidence),
    ...(issue.snippet === undefined ? {} : {snippet: issue.snippet}),
    fix: issue.fix,
  }
  return {fingerprint: findingFingerprint(core), ...core, suppressed: false}
}

export interface CompileTraceOptions {
  engineVersion?: string
  ruleset?: string
  suppressions?: Suppression[]
  agentChecksExecuted?: CheckExecution[]
  externalChecksExecuted?: CheckExecution[]
  generatedAt?: string
}

/** Compile trace schema v2. Version 1 remains a separate frozen type. */
export function compileTrace(result: ScanResult, options: CompileTraceOptions = {}): TraceV2 {
  const findings = result.issues
    .map(issueToFinding)
    .sort((left, right) =>
      `${left.source}|${left.check_id ?? left.rule_id}|${left.location.file}|${left.location.line ?? 0}|${left.fingerprint}`.localeCompare(
        `${right.source}|${right.check_id ?? right.rule_id}|${right.location.file}|${right.location.line ?? 0}|${right.fingerprint}`,
      ),
    )
  const suppressions = applySuppressions(findings, options.suppressions ?? [])
  const deterministicExecutions = result.scan.checks_executed.map((execution) => withFindingCount(execution, findings))
  const explicitAgent = new Map((options.agentChecksExecuted ?? []).map((execution) => [execution.id, execution]))
  const agentExecutions: CheckExecution[] = [...loadChecks().values()].map((check) => {
    const explicit = explicitAgent.get(check.id)
    if (explicit) return withFindingCount(explicit, findings)
    return {
      id: check.id,
      version: check.version,
      kind: 'agent',
      status: 'unresolved',
      required: false,
      applicable: true,
      languages: result.detection.languages.map((language) => language.name),
      framework: result.detection.framework,
      surface: result.detection.surface,
      inspected_files: [],
      findings: findings.filter((finding) => finding.source === 'agent' && finding.check_id === check.id).length,
      analysis_mode: 'agent',
      reason: {code: 'not_reported', message: 'Agent investigation was not reported as completed.'},
      prompt: check.prompt,
      prompt_hash: check.prompt_hash,
      guidance: 'Run this check with a coding agent and return its structured execution record.',
    }
  })
  const externalById = new Map((options.externalChecksExecuted ?? []).map((execution) => [execution.id, execution]))
  for (const finding of findings.filter((item) => item.source === 'external')) {
    if (finding.rule_id && !externalById.has(finding.rule_id)) {
      externalById.set(finding.rule_id, {
        id: finding.rule_id,
        version: finding.rule_version ?? 1,
        kind: 'external',
        status: 'executed',
        required: false,
        applicable: true,
        languages: result.detection.languages.map((language) => language.name),
        framework: result.detection.framework,
        surface: result.detection.surface,
        inspected_files: [
          ...new Set(
            findings
              .filter((item) => item.source === 'external' && item.rule_id === finding.rule_id)
              .map((item) => item.location.file),
          ),
        ],
        findings: 0,
        analysis_mode: 'external',
      })
    }
  }
  const checksExecuted = [...deterministicExecutions, ...agentExecutions, ...externalById.values()]
    .map((execution) => sanitizeExecution(withFindingCount(execution, findings)))
    .sort((left, right) => `${left.kind}|${left.id}`.localeCompare(`${right.kind}|${right.id}`))

  const unsigned = {
    schema_version: TRACE_SCHEMA_VERSION,
    engine: {
      name: ENGINE_NAME,
      version: redactText(options.engineVersion ?? result.version),
      ruleset: redactText(options.ruleset ?? `app-doctor-rules@${result.version}`),
    },
    generated_at: options.generatedAt ?? new Date().toISOString(),
    project: {
      commit: result.project.commit,
      dirty: result.project.dirty,
      input_hash: result.scan.input_hash,
      input_hashes: Object.fromEntries(
        Object.entries(result.scan.file_hashes ?? {}).map(([path, hash]) => [redactText(path), hash]),
      ),
    },
    detection: result.detection,
    score: result.score,
    findings,
    checks_executed: checksExecuted,
    suppressions,
    coverage: {
      files_scanned: result.scan.files_scanned,
      files_skipped: (result.scan.files_skipped ?? []).map((file) => ({
        ...file,
        path: redactText(file.path),
        ...(file.detail ? {detail: redactText(file.detail)} : {}),
      })),
      complete: result.scan.coverage_complete,
      gaps: result.scan.coverage_gaps.map((gap) => ({
        ...gap,
        message: redactText(gap.message),
        ...(gap.file ? {file: redactText(gap.file)} : {}),
      })),
    },
  }
  const trace: TraceV2 = {...unsigned, attestation: {digest: sha256(unsigned), signed: false}}
  const validation = validateTraceValue(trace)
  if (!validation.valid) {
    // Self-compiled traces are acyclic. A complexity miss on a large app must
    // still write a local trace; inbound validateTrace keeps the same cap.
    const complexityOnly = validation.errors.length === 1 && validation.errors[0] === TRACE_COMPLEXITY_ERROR
    if (!complexityOnly) throw new Error(`App Doctor produced an invalid trace: ${validation.errors.join('; ')}`)
  }
  return trace
}

function withFindingCount(execution: CheckExecution, findings: TraceFinding[]): CheckExecution {
  const source = execution.kind === 'deterministic' ? 'deterministic' : execution.kind
  return {
    ...execution,
    findings: findings.filter(
      (finding) =>
        finding.source === source && (source === 'agent' ? finding.check_id : finding.rule_id) === execution.id,
    ).length,
  }
}

function sanitizeExecution(execution: CheckExecution): CheckExecution {
  return {
    ...execution,
    id: redactText(execution.id),
    inspected_files: execution.inspected_files.map((path) => redactText(path)),
    ...(execution.reason ? {reason: {...execution.reason, message: redactText(execution.reason.message)}} : {}),
    ...(execution.guidance ? {guidance: redactText(execution.guidance)} : {}),
    ...(execution.implementations
      ? {
          implementations: execution.implementations.map((implementation) => ({
            ...implementation,
            inspected_files: implementation.inspected_files.map((path) => redactText(path)),
            ...(implementation.reason
              ? {reason: {...implementation.reason, message: redactText(implementation.reason.message)}}
              : {}),
          })),
        }
      : {}),
  }
}

function applySuppressions(findings: TraceFinding[], inputs: Suppression[]): Suppression[] {
  const ids = new Set<string>()
  const byFingerprint = new Map<string, Suppression>()
  for (const suppression of inputs) {
    const problem = validateSuppression(suppression)
    if (problem) throw new Error(`Invalid suppression ${redactText(suppression.id || '<unknown>')}: ${problem}`)
    if (ids.has(suppression.id)) throw new Error(`Duplicate suppression id: ${redactText(suppression.id)}`)
    if (byFingerprint.has(suppression.finding_fingerprint))
      throw new Error(`Multiple suppressions target finding ${suppression.finding_fingerprint}`)
    ids.add(suppression.id)
    byFingerprint.set(suppression.finding_fingerprint, suppression)
  }
  const used: Suppression[] = []
  for (const finding of findings) {
    const suppression = byFingerprint.get(finding.fingerprint)
    if (!suppression) continue
    const safe: Suppression = {
      ...suppression,
      id: redactText(suppression.id),
      justification: redactText(suppression.justification),
      provenance: {
        ...suppression.provenance,
        ...(suppression.provenance.actor ? {actor: redactText(suppression.provenance.actor)} : {}),
      },
    }
    finding.suppressed = true
    finding.suppression = {id: safe.id, justification: safe.justification, provenance: safe.provenance}
    used.push(safe)
  }
  if (used.length !== inputs.length) {
    const current = new Set(findings.map((finding) => finding.fingerprint))
    throw new Error(
      `Suppressions did not match current findings: ${inputs
        .filter((item) => !current.has(item.finding_fingerprint))
        .map((item) => redactText(item.id))
        .join(', ')}`,
    )
  }
  return used.sort((left, right) => left.id.localeCompare(right.id))
}

export function validateSuppression(value: unknown): string | undefined {
  if (!isObject(value)) return 'must be an object'
  if (typeof value.id !== 'string' || !value.id.trim()) return 'id is required'
  if (typeof value.finding_fingerprint !== 'string' || !SHA256.test(value.finding_fingerprint))
    return 'finding_fingerprint must be a SHA-256 digest'
  if (typeof value.justification !== 'string' || !value.justification.trim()) return 'justification is required'
  if (!isObject(value.provenance) || !['human', 'policy', 'external'].includes(String(value.provenance.source)))
    return 'provenance source is invalid'
  if (!(value.provenance.actor === undefined || typeof value.provenance.actor === 'string'))
    return 'provenance actor must be a string'
  if (typeof value.provenance.created_at !== 'string' || Number.isNaN(Date.parse(value.provenance.created_at)))
    return 'provenance created_at must be an ISO date'
  return undefined
}

export function isTraceSchemaVersionSupported(version: unknown): version is typeof TRACE_SCHEMA_VERSION {
  return SUPPORTED_TRACE_SCHEMA_VERSIONS.includes(version as typeof TRACE_SCHEMA_VERSION)
}

export interface TraceValidationResult {
  valid: boolean
  errors: string[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const validPath = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1_024 &&
  !value.includes('\0') &&
  !value.startsWith('/') &&
  !/^[a-zA-Z]:[\\/]/.test(value) &&
  !value.split(/[\\/]/).includes('..')
const validLocation = (value: unknown): boolean =>
  isObject(value) &&
  validPath(value.file) &&
  (value.line === undefined || (Number.isInteger(value.line) && Number(value.line) > 0)) &&
  (value.column === undefined || (Number.isInteger(value.column) && Number(value.column) > 0))

const validDetection = (value: unknown): boolean =>
  isObject(value) &&
  FRAMEWORKS.has(String(value.framework)) &&
  SURFACES.has(String(value.surface)) &&
  Array.isArray(value.languages) &&
  value.languages.every(
    (language) =>
      isObject(language) &&
      typeof language.name === 'string' &&
      language.name.length > 0 &&
      (language.support === 'supported' || language.support === 'unsupported') &&
      Array.isArray(language.files) &&
      language.files.every(validPath),
  )

const validReason = (value: unknown): boolean =>
  isObject(value) &&
  REASON_CODES.has(String(value.code)) &&
  typeof value.message === 'string' &&
  value.message.trim().length > 0

const inspectUnknownValue = (root: unknown): {containsSecret: boolean; unsafe: boolean} => {
  const stack: {value: unknown; depth: number}[] = [{value: root, depth: 0}]
  const seen = new WeakSet<object>()
  let containsSecret = false
  let visited = 0
  while (stack.length > 0) {
    const {value, depth} = stack.pop()!
    if (++visited > MAX_TRACE_VALIDATION_NODES || depth > MAX_TRACE_VALIDATION_DEPTH) {
      return {containsSecret, unsafe: true}
    }
    if (typeof value === 'string') {
      if (redactText(value) !== value) containsSecret = true
      continue
    }
    if (value === null || typeof value !== 'object') continue
    if (seen.has(value)) continue
    seen.add(value)
    if (Array.isArray(value)) {
      for (const item of value) stack.push({value: item, depth: depth + 1})
      continue
    }
    // Scan keys for leaked secrets without counting them as graph nodes.
    // Walking Object.entries().flat() treated every input_hashes path as a
    // nested visit and rejected large-but-valid apps as "cyclic".
    for (const [key, child] of Object.entries(value)) {
      if (redactText(key) !== key) containsSecret = true
      stack.push({value: child, depth: depth + 1})
    }
  }
  return {containsSecret, unsafe: false}
}

function validateFindingValue(finding: Record<string, unknown>, index: number, errors: string[]): void {
  const source = String(finding.source)
  if (!['deterministic', 'agent', 'external'].includes(source)) errors.push(`findings[${index}].source is invalid`)
  if (!SEVERITIES.has(finding.severity as Severity)) errors.push(`findings[${index}].severity is invalid`)
  if (!validLocation(finding.location)) errors.push(`findings[${index}].location is invalid`)
  if (
    typeof finding.title !== 'string' ||
    !finding.title.trim() ||
    typeof finding.message !== 'string' ||
    !finding.message.trim() ||
    typeof finding.fingerprint !== 'string' ||
    !SHA256.test(finding.fingerprint) ||
    typeof finding.suppressed !== 'boolean' ||
    !isObject(finding.fix) ||
    typeof finding.fix.automated !== 'boolean' ||
    typeof finding.fix.description !== 'string' ||
    !finding.fix.description.trim()
  )
    errors.push(`findings[${index}] title, message, fingerprint, fix, and suppression state are required`)
  if (
    source === 'agent' &&
    (typeof finding.check_id !== 'string' ||
      !Number.isInteger(finding.check_version) ||
      Number(finding.check_version) < 1 ||
      typeof finding.prompt_hash !== 'string' ||
      !SHA256.test(finding.prompt_hash))
  )
    errors.push(`findings[${index}] agent provenance is required`)
  if (
    source !== 'agent' &&
    (typeof finding.rule_id !== 'string' || !Number.isInteger(finding.rule_version) || Number(finding.rule_version) < 1)
  )
    errors.push(`findings[${index}] rule provenance is required`)
  if (
    !Array.isArray(finding.evidence) ||
    finding.evidence.some((item) => !isObject(item) || !validLocation(item.location))
  )
    errors.push(`findings[${index}].evidence is invalid`)
  else if (validLocation(finding.location) && isObject(finding.fix) && SEVERITIES.has(finding.severity as Severity)) {
    const core = {
      source: finding.source as TraceFinding['source'],
      ...(source === 'agent'
        ? {
            check_id: finding.check_id as string,
            check_version: finding.check_version as number,
            prompt_hash: finding.prompt_hash as string,
          }
        : {rule_id: finding.rule_id as string, rule_version: finding.rule_version as number}),
      severity: finding.severity as Severity,
      title: finding.title as string,
      message: finding.message as string,
      location: finding.location as Location,
      evidence: finding.evidence as unknown as FindingEvidence[],
      ...(finding.snippet === undefined ? {} : {snippet: finding.snippet as string}),
      fix: finding.fix as unknown as TraceFinding['fix'],
    }
    if (finding.fingerprint !== findingFingerprint(core)) errors.push(`findings[${index}].fingerprint mismatch`)
  }
}

function validateImplementationValue(
  implementation: Record<string, unknown>,
  executionIndex: number,
  implementationIndex: number,
  errors: string[],
): void {
  const label = `checks_executed[${executionIndex}].implementations[${implementationIndex}]`
  const status = implementation.status as CheckExecutionStatus
  const mode = implementation.analysis_mode as AnalysisMode
  if (
    typeof implementation.id !== 'string' ||
    !implementation.id ||
    !EXECUTION_STATUSES.has(status) ||
    !ANALYSIS_MODES.has(mode) ||
    !Array.isArray(implementation.inspected_files) ||
    implementation.inspected_files.some((path) => !validPath(path)) ||
    !Number.isInteger(implementation.findings) ||
    Number(implementation.findings) < 0
  )
    errors.push(`${label} is invalid`)
  if (['not_applicable', 'unsupported_framework', 'unresolved'].includes(status) && !validReason(implementation.reason))
    errors.push(`${label} non-executed implementation requires a structured reason`)
  if (
    status === 'executed' &&
    ['regex', 'ast'].includes(mode) &&
    (implementation.inspected_files as unknown[]).length === 0
  )
    errors.push(`${label} source-based implementation requires inspected files`)
  if ((status === 'not_applicable' || status === 'unsupported_framework') && Number(implementation.findings) !== 0)
    errors.push(`${label} ${status} implementation must have zero findings`)
}

function validateExecutionValue(execution: Record<string, unknown>, index: number, errors: string[]): void {
  const status = execution.status as CheckExecutionStatus
  const mode = execution.analysis_mode as AnalysisMode
  if (
    typeof execution.id !== 'string' ||
    !execution.id ||
    !Number.isInteger(execution.version) ||
    Number(execution.version) < 1 ||
    !['deterministic', 'agent', 'external'].includes(String(execution.kind)) ||
    !EXECUTION_STATUSES.has(status) ||
    typeof execution.required !== 'boolean' ||
    typeof execution.applicable !== 'boolean' ||
    !Array.isArray(execution.languages) ||
    execution.languages.some((language) => typeof language !== 'string') ||
    !FRAMEWORKS.has(String(execution.framework)) ||
    !SURFACES.has(String(execution.surface)) ||
    !Array.isArray(execution.inspected_files) ||
    execution.inspected_files.some((path) => !validPath(path)) ||
    !Number.isInteger(execution.findings) ||
    Number(execution.findings) < 0 ||
    !ANALYSIS_MODES.has(mode)
  )
    errors.push(`checks_executed[${index}] is invalid`)
  if (
    (status === 'unsupported_framework' || status === 'unresolved') &&
    (!validReason(execution.reason) || typeof execution.guidance !== 'string' || !execution.guidance.trim())
  )
    errors.push(`checks_executed[${index}] unsupported or unresolved execution requires reason and handoff guidance`)
  if (status === 'not_applicable' && !validReason(execution.reason))
    errors.push(`checks_executed[${index}] not_applicable execution requires a reason`)
  if ((status === 'not_applicable') !== (execution.applicable === false))
    errors.push(`checks_executed[${index}] applicability is inconsistent with its status`)
  if (
    status === 'executed' &&
    ['regex', 'ast', 'agent'].includes(mode) &&
    (execution.inspected_files as unknown[]).length === 0
  )
    errors.push(`checks_executed[${index}] source-based execution requires inspected files`)
  if (
    execution.kind === 'agent' &&
    (typeof execution.prompt !== 'string' ||
      !execution.prompt.trim() ||
      typeof execution.prompt_hash !== 'string' ||
      !SHA256.test(execution.prompt_hash) ||
      typeof execution.guidance !== 'string' ||
      !execution.guidance.trim())
  )
    errors.push(`checks_executed[${index}] agent prompt provenance is required`)
  else if (execution.kind === 'agent' && execution.prompt_hash !== sha256(execution.prompt))
    errors.push(`checks_executed[${index}] agent prompt hash is invalid`)

  if (execution.implementations !== undefined) {
    if (
      execution.kind !== 'deterministic' ||
      !Array.isArray(execution.implementations) ||
      execution.implementations.length === 0
    ) {
      errors.push(`checks_executed[${index}].implementations is invalid`)
    } else {
      const implementationIds = new Set<string>()
      execution.implementations.forEach((implementation, implementationIndex) => {
        if (!isObject(implementation)) {
          errors.push(`checks_executed[${index}].implementations[${implementationIndex}] is invalid`)
          return
        }
        validateImplementationValue(implementation, index, implementationIndex, errors)
        if (implementationIds.has(String(implementation.id)))
          errors.push(`checks_executed[${index}].implementations[${implementationIndex}] is duplicated`)
        implementationIds.add(String(implementation.id))
      })
      const hasUnresolved = execution.implementations.some(
        (implementation) => isObject(implementation) && implementation.status === 'unresolved',
      )
      const hasUnsupported = execution.implementations.some(
        (implementation) => isObject(implementation) && implementation.status === 'unsupported_framework',
      )
      const partiallyUnsupported =
        hasUnsupported &&
        execution.implementations.some(
          (implementation) => isObject(implementation) && implementation.status === 'executed',
        )
      if (
        (status === 'unresolved') !== (hasUnresolved || partiallyUnsupported) ||
        (status === 'executed' && hasUnsupported)
      )
        errors.push(`checks_executed[${index}] status is inconsistent with its implementations`)
      const implementationFiles = new Set(
        execution.implementations.flatMap((implementation) =>
          isObject(implementation) && Array.isArray(implementation.inspected_files)
            ? implementation.inspected_files.filter((path): path is string => typeof path === 'string')
            : [],
        ),
      )
      const executionFiles = new Set((execution.inspected_files as string[]) ?? [])
      if (
        implementationFiles.size !== executionFiles.size ||
        [...implementationFiles].some((path) => !executionFiles.has(path))
      )
        errors.push(`checks_executed[${index}] inspected files are inconsistent with its implementations`)
      const implementationFindings = execution.implementations.reduce(
        (total, implementation) =>
          total +
          (isObject(implementation) && Number.isInteger(implementation.findings) ? Number(implementation.findings) : 0),
        0,
      )
      if (implementationFindings !== Number(execution.findings))
        errors.push(`checks_executed[${index}] findings are inconsistent with its implementations`)
    }
  }
}

function validateTraceValue(value: unknown): TraceValidationResult {
  const errors: string[] = []
  if (!isObject(value)) return {valid: false, errors: ['trace must be an object']}
  const inspection = inspectUnknownValue(value)
  if (inspection.unsafe) return {valid: false, errors: [TRACE_COMPLEXITY_ERROR]}
  if (!isTraceSchemaVersionSupported(value.schema_version))
    errors.push(`unsupported schema_version: ${String(value.schema_version)}`)
  if (
    !isObject(value.engine) ||
    value.engine.name !== ENGINE_NAME ||
    typeof value.engine.version !== 'string' ||
    !value.engine.version ||
    typeof value.engine.ruleset !== 'string' ||
    !value.engine.ruleset
  )
    errors.push('engine name, version, and ruleset are required')
  if (
    !isObject(value.project) ||
    !SHA256.test(String(value.project.input_hash)) ||
    !isObject(value.project.input_hashes) ||
    !Object.entries(value.project.input_hashes).every(([path, hash]) => validPath(path) && SHA256.test(String(hash))) ||
    !(value.project.commit === null || (typeof value.project.commit === 'string' && value.project.commit.length > 0)) ||
    !(value.project.dirty === null || typeof value.project.dirty === 'boolean')
  )
    errors.push('project commit, dirty state, input_hash, and input_hashes are required')
  if (typeof value.generated_at !== 'string' || Number.isNaN(Date.parse(value.generated_at)))
    errors.push('generated_at must be an ISO date')
  if (!validDetection(value.detection)) errors.push('detection is invalid')
  if (
    !(
      value.score === null ||
      (isObject(value.score) &&
        Number.isInteger(value.score.total) &&
        Number(value.score.total) >= 0 &&
        Number(value.score.total) <= 100 &&
        Number.isInteger(value.score.baseline) &&
        Number(value.score.baseline) === 100 &&
        ['EXCELLENT', 'GOOD', 'NEEDS_WORK', 'POOR'].includes(String(value.score.grade)))
    )
  )
    errors.push('score is invalid')

  if (Array.isArray(value.findings))
    value.findings.forEach((finding, index) =>
      isObject(finding)
        ? validateFindingValue(finding, index, errors)
        : errors.push(`findings[${index}] must be an object`),
    )
  else errors.push('findings must be an array')
  if (Array.isArray(value.checks_executed))
    value.checks_executed.forEach((execution, index) =>
      isObject(execution)
        ? validateExecutionValue(execution, index, errors)
        : errors.push(`checks_executed[${index}] is invalid`),
    )
  else errors.push('checks_executed must be an array')

  if (Array.isArray(value.checks_executed) && Array.isArray(value.findings)) {
    const executions = value.checks_executed.filter(isObject)
    const findings = value.findings.filter(isObject)
    const keys = new Set<string>()
    executions.forEach((execution, index) => {
      const key = `${execution.kind}|${execution.id}`
      if (keys.has(key)) errors.push(`checks_executed[${index}] is duplicated`)
      keys.add(key)
      const source = execution.kind === 'deterministic' ? 'deterministic' : execution.kind
      const actual = findings.filter(
        (finding) =>
          finding.source === source && (source === 'agent' ? finding.check_id : finding.rule_id) === execution.id,
      ).length
      if (execution.findings !== actual) errors.push(`checks_executed[${index}].findings doesn't match findings`)
      if (
        (execution.status === 'not_applicable' || execution.status === 'unsupported_framework') &&
        (actual > 0 || Number(execution.findings) > 0)
      )
        errors.push(`checks_executed[${index}] must have zero findings for status ${String(execution.status)}`)
    })
    findings.forEach((finding, index) => {
      const kind = finding.source === 'deterministic' ? 'deterministic' : finding.source
      const id = finding.source === 'agent' ? finding.check_id : finding.rule_id
      const execution = executions.find((candidate) => candidate.kind === kind && candidate.id === id)
      if (!execution || !['executed', 'unresolved'].includes(String(execution.status))) {
        errors.push(`findings[${index}] has no executed or partially executed check record`)
      } else if (
        execution.version !== (finding.source === 'agent' ? finding.check_version : finding.rule_version) ||
        (finding.source === 'agent' && execution.prompt_hash !== finding.prompt_hash)
      ) {
        errors.push(`findings[${index}] provenance doesn't match its execution record`)
      }
    })
  }

  if (Array.isArray(value.suppressions))
    value.suppressions.forEach((suppression, index) => {
      if (validateSuppression(suppression)) errors.push(`suppressions[${index}] is invalid`)
    })
  else errors.push('suppressions must be an array')
  if (Array.isArray(value.findings) && Array.isArray(value.suppressions))
    validateSuppressionLinks(value.findings, value.suppressions, errors)

  if (
    !isObject(value.coverage) ||
    !Number.isInteger(value.coverage.files_scanned) ||
    Number(value.coverage.files_scanned) < 0 ||
    typeof value.coverage.complete !== 'boolean' ||
    !Array.isArray(value.coverage.files_skipped) ||
    !Array.isArray(value.coverage.gaps) ||
    value.coverage.gaps.some(
      (gap) =>
        !isObject(gap) ||
        !['skipped_file', 'unsupported_framework', 'unsupported_language', 'unresolved_check'].includes(
          String(gap.code),
        ) ||
        typeof gap.message !== 'string' ||
        !gap.message.trim() ||
        !(gap.check_id === undefined || (typeof gap.check_id === 'string' && gap.check_id.length > 0)) ||
        !(gap.file === undefined || validPath(gap.file)),
    ) ||
    value.coverage.files_skipped.some(
      (file) => !isObject(file) || !validPath(file.path) || !['too_large', 'unreadable'].includes(String(file.reason)),
    )
  )
    errors.push('coverage is invalid')
  else {
    const requiredUnresolved =
      Array.isArray(value.checks_executed) &&
      value.checks_executed.some(
        (execution) =>
          isObject(execution) &&
          execution.required === true &&
          (execution.status === 'unsupported_framework' || execution.status === 'unresolved'),
      )
    const unsupportedLanguage =
      isObject(value.detection) &&
      Array.isArray(value.detection.languages) &&
      value.detection.languages.some((language) => isObject(language) && language.support === 'unsupported')
    const canBeComplete =
      value.coverage.files_skipped.length === 0 &&
      value.coverage.gaps.length === 0 &&
      !requiredUnresolved &&
      !unsupportedLanguage
    if (value.coverage.complete !== canBeComplete) errors.push('coverage complete claim is inconsistent')
    if (value.coverage.complete && value.score === null) errors.push('complete coverage requires a score')
    if (!value.coverage.complete && value.score !== null) errors.push("incomplete coverage can't have a score")
  }
  if (inspection.containsSecret) errors.push('trace contains an unredacted matched secret')
  if (
    !isObject(value.attestation) ||
    value.attestation.signed !== false ||
    !SHA256.test(String(value.attestation.digest))
  )
    errors.push('attestation must contain a SHA-256 digest and signed:false')
  else {
    const {attestation: _attestation, ...unsigned} = value
    if (value.attestation.digest !== sha256(unsigned)) errors.push('attestation digest mismatch')
  }
  return {valid: errors.length === 0, errors}
}

function validateSuppressionLinks(findings: unknown[], suppressions: unknown[], errors: string[]): void {
  const findingFingerprints = new Set(findings.filter(isObject).map((finding) => finding.fingerprint))
  const suppressionById = new Map(suppressions.filter(isObject).map((item) => [item.id, item]))
  suppressions.filter(isObject).forEach((suppression, index) => {
    if (!findingFingerprints.has(suppression.finding_fingerprint))
      errors.push(`suppressions[${index}] targets an unknown finding`)
  })
  findings.filter(isObject).forEach((finding, index) => {
    if (
      finding.suppression !== undefined &&
      (!isObject(finding.suppression) || !suppressionById.has(finding.suppression.id))
    )
      errors.push(`findings[${index}].suppression is not declared`)
    else if (isObject(finding.suppression)) {
      const declared = suppressionById.get(finding.suppression.id)
      if (
        isObject(declared) &&
        (declared.finding_fingerprint !== finding.fingerprint ||
          declared.justification !== finding.suppression.justification ||
          canonicalJson(declared.provenance) !== canonicalJson(finding.suppression.provenance))
      )
        errors.push(`findings[${index}].suppression does not match its declaration`)
    }
    if ((finding.suppressed === true) !== (finding.suppression !== undefined))
      errors.push(`findings[${index}].suppression state is inconsistent`)
  })
}

export function validateTrace(value: unknown): TraceValidationResult {
  try {
    return validateTraceValue(value)
    // Validation is a trust boundary and must fail closed for all malformed input.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {
      valid: false,
      errors: [`trace validation failed safely: ${error instanceof Error ? error.message : String(error)}`],
    }
  }
}

export function assertCompatibleTrace(value: unknown): asserts value is TraceV2 {
  const validation = validateTrace(value)
  if (!validation.valid) throw new Error(`Invalid App Doctor trace: ${validation.errors.join('; ')}`)
}
