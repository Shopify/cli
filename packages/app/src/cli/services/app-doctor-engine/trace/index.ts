import {ENGINE_NAME, SUPPORTED_TRACE_SCHEMA_VERSIONS, TRACE_SCHEMA_VERSION} from '../types.js'
import {loadChecks} from '../checks/index.js'
import {redactText} from '../rules/secret-rules.js'
import {createHash} from 'node:crypto'
import type {
  CheckExecution,
  FindingEvidence,
  Issue,
  Location,
  ScanResult,
  Severity,
  Suppression,
  TraceFinding,
  TraceV1,
} from '../types.js'

const SHA256 = /^sha256:[0-9a-f]{64}$/
const SEVERITIES = new Set<Severity>(['critical', 'high', 'medium', 'low'])

/** Stable JSON for hashes and fingerprints. Object keys are sorted recursively. */
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

/** Central output boundary: all untrusted and scanner finding text is redacted here. */
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

function issueFindingSource(issue: Issue): TraceFinding['source'] {
  if (issue.found_by === 'agent') return 'agent'
  if (issue.found_by === 'external') return 'external'
  return 'deterministic'
}

function issueToFinding(issueInput: Issue): TraceFinding {
  const issue = redactIssue(issueInput)
  const source = issueFindingSource(issue)
  const core: Omit<TraceFinding, 'fingerprint' | 'suppression' | 'suppressed'> = {
    source,
    ...(source === 'agent'
      ? {
          check_id: issue.id,
          check_version: issue.check_version,
          prompt_hash: issue.prompt_hash,
        }
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

/** Compile a portable trace v1 from a deterministic scan and merged findings. */
export function compileTrace(result: ScanResult, options: CompileTraceOptions = {}): TraceV1 {
  const findings = result.issues
    .map(issueToFinding)
    .sort((left, right) =>
      `${left.source}|${left.check_id ?? left.rule_id}|${left.location.file}|${left.location.line ?? 0}|${left.fingerprint}`.localeCompare(
        `${right.source}|${right.check_id ?? right.rule_id}|${right.location.file}|${right.location.line ?? 0}|${right.fingerprint}`,
      ),
    )
  const suppressionInputs = options.suppressions ?? []
  const suppressionIds = new Set<string>()
  const suppressionByFingerprint = new Map<string, Suppression>()
  for (const suppression of suppressionInputs) {
    const problem = validateSuppression(suppression)
    if (problem) throw new Error(`Invalid suppression ${redactText(suppression.id || '<unknown>')}: ${problem}`)
    if (suppressionIds.has(suppression.id)) throw new Error(`Duplicate suppression id: ${redactText(suppression.id)}`)
    if (suppressionByFingerprint.has(suppression.finding_fingerprint))
      throw new Error(`Multiple suppressions target finding ${suppression.finding_fingerprint}`)
    suppressionIds.add(suppression.id)
    suppressionByFingerprint.set(suppression.finding_fingerprint, suppression)
  }
  const usedSuppressions: Suppression[] = []
  for (const finding of findings) {
    const suppression = suppressionByFingerprint.get(finding.fingerprint)
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
    finding.suppression = {
      id: safe.id,
      justification: safe.justification,
      provenance: safe.provenance,
    }
    usedSuppressions.push(safe)
  }
  if (usedSuppressions.length !== suppressionInputs.length) {
    const findingFingerprints = new Set(findings.map((finding) => finding.fingerprint))
    const unmatched = suppressionInputs
      .filter((suppression) => !findingFingerprints.has(suppression.finding_fingerprint))
      .map((suppression) => redactText(suppression.id))
    throw new Error(`Suppressions did not match current findings: ${unmatched.join(', ')}`)
  }

  const deterministicExecutions = (result.scan.checks_executed ?? []).map((execution) => ({
    ...execution,
    findings: findings.filter((finding) => finding.source === 'deterministic' && finding.rule_id === execution.id)
      .length,
  }))
  const checks = loadChecks()
  const explicitAgent = new Map((options.agentChecksExecuted ?? []).map((execution) => [execution.id, execution]))
  const agentExecutions: CheckExecution[] = [...checks.values()].map((check) => {
    const explicit = explicitAgent.get(check.id)
    const count = findings.filter((finding) => finding.source === 'agent' && finding.check_id === check.id).length
    if (explicit) return {...explicit, findings: count}

    return {
      id: check.id,
      version: check.version,
      kind: 'check',
      status: count > 0 ? 'executed' : 'skipped',
      findings: count,
      prompt_hash: check.prompt_hash,
      ...(count > 0 ? {} : {reason: 'agent review not reported as executed'}),
    }
  })
  const externalById = new Map((options.externalChecksExecuted ?? []).map((execution) => [execution.id, execution]))
  for (const finding of findings.filter((item) => item.source === 'external')) {
    if (!externalById.has(finding.rule_id!)) {
      externalById.set(finding.rule_id!, {
        id: finding.rule_id!,
        version: finding.rule_version!,
        kind: 'external',
        status: 'executed',
        findings: 0,
      })
    }
  }
  const externalExecutions = [...externalById.values()].map((execution) => ({
    ...execution,
    findings: findings.filter((finding) => finding.source === 'external' && finding.rule_id === execution.id).length,
  }))
  const checksExecuted = [...deterministicExecutions, ...agentExecutions, ...externalExecutions]
    .map((execution) => ({
      ...execution,
      id: redactText(execution.id),
      ...(execution.reason ? {reason: redactText(execution.reason)} : {}),
    }))
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
    findings,
    checks_executed: checksExecuted,
    suppressions: usedSuppressions.sort((left, right) => left.id.localeCompare(right.id)),
    coverage: {
      files_scanned: result.scan.files_scanned,
      files_skipped: (result.scan.files_skipped ?? []).map((file) => ({
        ...file,
        path: redactText(file.path),
        ...(file.detail ? {detail: redactText(file.detail)} : {}),
      })),
      complete: result.scan.files_skipped_count === 0,
    },
  }
  return {
    ...unsigned,
    attestation: {digest: sha256(unsigned), signed: false},
  }
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

const inspectUnknownValue = (root: unknown): {containsSecret: boolean; unsafe: boolean} => {
  const stack: {value: unknown; depth: number}[] = [{value: root, depth: 0}]
  const seen = new WeakSet<object>()
  let containsSecret = false
  let visited = 0
  while (stack.length > 0) {
    const {value, depth} = stack.pop()!
    if (++visited > 50_000 || depth > 100) return {containsSecret, unsafe: true}
    if (typeof value === 'string') {
      if (redactText(value) !== value) containsSecret = true
      continue
    }
    if (value === null || typeof value !== 'object') continue
    if (seen.has(value)) continue
    seen.add(value)
    if (Array.isArray(value)) {
      for (const item of value) stack.push({value: item, depth: depth + 1})
    } else {
      for (const [key, item] of Object.entries(value)) {
        if (redactText(key) !== key) containsSecret = true
        stack.push({value: item, depth: depth + 1})
      }
    }
  }
  return {containsSecret, unsafe: false}
}

/** Runtime contract validator for traces created by any producer, including outside Shopify CLI. */
function validateTraceValue(value: unknown): TraceValidationResult {
  const errors: string[] = []
  if (!isObject(value)) return {valid: false, errors: ['trace must be an object']}
  const inspection = inspectUnknownValue(value)
  if (inspection.unsafe)
    return {
      valid: false,
      errors: ['trace is cyclic or exceeds validation complexity limits'],
    }
  if (!isTraceSchemaVersionSupported(value.schema_version))
    errors.push(`unsupported schema_version: ${String(value.schema_version)}`)
  if (
    !isObject(value.engine) ||
    value.engine.name !== ENGINE_NAME ||
    typeof value.engine.version !== 'string' ||
    !value.engine.version.trim() ||
    typeof value.engine.ruleset !== 'string' ||
    !value.engine.ruleset.trim()
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
  if (Array.isArray(value.findings)) {
    value.findings.forEach((finding, index) => {
      if (!isObject(finding)) return errors.push(`findings[${index}] must be an object`)
      if (!['deterministic', 'agent', 'external'].includes(String(finding.source)))
        errors.push(`findings[${index}].source is invalid`)
      if (!SEVERITIES.has(finding.severity as Severity)) errors.push(`findings[${index}].severity is invalid`)
      if (!validLocation(finding.location)) errors.push(`findings[${index}].location is invalid`)
      if (
        typeof finding.title !== 'string' ||
        !finding.title.trim() ||
        typeof finding.message !== 'string' ||
        !finding.message.trim() ||
        !(finding.snippet === undefined || typeof finding.snippet === 'string') ||
        typeof finding.fingerprint !== 'string' ||
        !SHA256.test(finding.fingerprint) ||
        typeof finding.suppressed !== 'boolean' ||
        !isObject(finding.fix) ||
        typeof finding.fix.automated !== 'boolean' ||
        typeof finding.fix.description !== 'string' ||
        !finding.fix.description.trim() ||
        !(finding.fix.guide === undefined || typeof finding.fix.guide === 'string')
      )
        errors.push(`findings[${index}] title, message, fingerprint, fix, and suppression state are required`)
      if (
        finding.source === 'agent' &&
        (typeof finding.check_id !== 'string' ||
          !Number.isInteger(finding.check_version) ||
          Number(finding.check_version) < 1 ||
          typeof finding.prompt_hash !== 'string' ||
          !SHA256.test(finding.prompt_hash))
      )
        errors.push(`findings[${index}] agent provenance is required`)
      if (
        finding.source !== 'agent' &&
        (typeof finding.rule_id !== 'string' ||
          !Number.isInteger(finding.rule_version) ||
          Number(finding.rule_version) < 1)
      )
        errors.push(`findings[${index}] rule provenance is required`)
      if (
        !Array.isArray(finding.evidence) ||
        finding.evidence.some(
          (item) =>
            !isObject(item) ||
            !validLocation(item.location) ||
            !(item.quote === undefined || typeof item.quote === 'string'),
        )
      )
        errors.push(`findings[${index}].evidence is invalid`)
      else if (
        validLocation(finding.location) &&
        typeof finding.message === 'string' &&
        typeof finding.title === 'string' &&
        isObject(finding.fix)
      ) {
        const core = {
          source: finding.source as TraceFinding['source'],
          ...(finding.source === 'agent'
            ? {
                check_id: finding.check_id as string,
                check_version: finding.check_version as number,
                prompt_hash: finding.prompt_hash as string,
              }
            : {
                rule_id: finding.rule_id as string,
                rule_version: finding.rule_version as number,
              }),
          severity: finding.severity as Severity,
          title: finding.title,
          message: finding.message,
          location: finding.location as Location,
          evidence: finding.evidence as unknown as FindingEvidence[],
          ...(finding.snippet === undefined ? {} : {snippet: finding.snippet as string}),
          fix: finding.fix as unknown as TraceFinding['fix'],
        }
        if (finding.fingerprint !== findingFingerprint(core)) errors.push(`findings[${index}].fingerprint mismatch`)
      }
    })
  } else errors.push('findings must be an array')
  if (Array.isArray(value.checks_executed)) {
    value.checks_executed.forEach((execution, index) => {
      if (
        !isObject(execution) ||
        typeof execution.id !== 'string' ||
        !Number.isInteger(execution.version) ||
        Number(execution.version) < 1 ||
        !['rule', 'check', 'external'].includes(String(execution.kind)) ||
        !['executed', 'skipped'].includes(String(execution.status)) ||
        !Number.isInteger(execution.findings) ||
        Number(execution.findings) < 0 ||
        !(execution.reason === undefined || typeof execution.reason === 'string') ||
        !(
          execution.prompt_hash === undefined ||
          (typeof execution.prompt_hash === 'string' && SHA256.test(execution.prompt_hash))
        )
      )
        errors.push(`checks_executed[${index}] is invalid`)
    })
  } else errors.push('checks_executed must be an array')
  if (Array.isArray(value.checks_executed) && Array.isArray(value.findings)) {
    const executions: unknown[] = value.checks_executed
    const traceFindings: unknown[] = value.findings
    const executionKeys = new Set<string>()
    executions.filter(isObject).forEach((execution, index) => {
      const key = `${execution.kind}|${execution.id}`
      if (executionKeys.has(key)) errors.push(`checks_executed[${index}] is duplicated`)
      executionKeys.add(key)
      let source: TraceFinding['source'] = 'external'
      if (execution.kind === 'rule') source = 'deterministic'
      else if (execution.kind === 'check') source = 'agent'
      const actual = traceFindings.filter(
        (finding) =>
          isObject(finding) &&
          finding.source === source &&
          (source === 'agent' ? finding.check_id : finding.rule_id) === execution.id,
      ).length
      if (execution.findings !== actual) errors.push(`checks_executed[${index}].findings does not match findings`)
      if (execution.status === 'skipped' && actual !== 0)
        errors.push(`checks_executed[${index}] is skipped but has findings`)
    })
    traceFindings.filter(isObject).forEach((finding, index) => {
      let kind = 'external'
      if (finding.source === 'deterministic') kind = 'rule'
      else if (finding.source === 'agent') kind = 'check'
      const id = finding.source === 'agent' ? finding.check_id : finding.rule_id
      const execution = executions.find(
        (candidate) => isObject(candidate) && candidate.kind === kind && candidate.id === id,
      )
      if (!isObject(execution) || execution.status !== 'executed')
        errors.push(`findings[${index}] has no executed check record`)
    })
  }
  if (Array.isArray(value.suppressions)) {
    value.suppressions.forEach((suppression, index) => {
      if (validateSuppression(suppression)) errors.push(`suppressions[${index}] is invalid`)
    })
  } else errors.push('suppressions must be an array')
  if (Array.isArray(value.findings) && Array.isArray(value.suppressions)) {
    const findingFingerprints = new Set(value.findings.filter(isObject).map((finding) => finding.fingerprint))
    const suppressionById = new Map(value.suppressions.filter(isObject).map((item) => [item.id, item]))
    value.suppressions.filter(isObject).forEach((suppression, index) => {
      if (!findingFingerprints.has(suppression.finding_fingerprint))
        errors.push(`suppressions[${index}] targets an unknown finding`)
    })
    value.findings.filter(isObject).forEach((finding, index) => {
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
  if (
    !isObject(value.coverage) ||
    !Number.isInteger(value.coverage.files_scanned) ||
    Number(value.coverage.files_scanned) < 0 ||
    typeof value.coverage.complete !== 'boolean' ||
    !Array.isArray(value.coverage.files_skipped) ||
    value.coverage.files_skipped.some(
      (file) =>
        !isObject(file) ||
        !validPath(file.path) ||
        !['too_large', 'unreadable'].includes(String(file.reason)) ||
        !(file.size_bytes === undefined || (Number.isInteger(file.size_bytes) && Number(file.size_bytes) >= 0)) ||
        !(file.detail === undefined || typeof file.detail === 'string'),
    ) ||
    value.coverage.complete !== (value.coverage.files_skipped.length === 0)
  )
    errors.push('coverage is invalid')
  if (inspection.containsSecret) errors.push('trace contains an unredacted matched secret')
  if (
    !isObject(value.attestation) ||
    value.attestation.signed !== false ||
    !SHA256.test(String(value.attestation.digest))
  )
    errors.push('attestation must contain a SHA-256 digest and signed:false')
  else {
    const {attestation: _attestation, ...unsigned} = value
    const expected = sha256(unsigned)
    if (value.attestation.digest !== expected) errors.push('attestation digest mismatch')
  }
  return {valid: errors.length === 0, errors}
}

export function validateTrace(value: unknown): TraceValidationResult {
  try {
    return validateTraceValue(value)
    // The public validation boundary must fail closed for all malformed input.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {
      valid: false,
      errors: [`trace validation failed safely: ${error instanceof Error ? error.message : String(error)}`],
    }
  }
}

export function assertCompatibleTrace(value: unknown): asserts value is TraceV1 {
  const validation = validateTrace(value)
  if (!validation.valid) throw new Error(`Invalid App Doctor trace: ${validation.errors.join('; ')}`)
}
