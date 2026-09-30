import {ENGINE_NAME, SUPPORTED_TRACE_SCHEMA_VERSIONS, TRACE_SCHEMA_VERSION} from '../types.js'
import {redactText} from '../rules/secret-rules.js'
import type {
  AnalysisMode,
  CheckExecution,
  CheckExecutionStatus,
  FindingEvidence,
  Issue,
  Location,
  ScanResult,
  Severity,
  TraceFinding,
  TraceV3,
} from '../types.js'

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
const ANALYSIS_MODES = new Set<AnalysisMode>(['regex', 'structured_config', 'ast'])
const REASON_CODES = new Set([
  'capability_absent',
  'no_relevant_files',
  'unsupported_framework',
  'unsupported_language',
  'parser_unavailable',
  'agent_investigation_required',
  'input_rejected',
])
const FRAMEWORKS = new Set(['react_router', 'none', 'unknown', 'mixed'])
const SURFACES = new Set(['react_router', 'theme_app_extension', 'config_only', 'unknown', 'mixed'])

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

function issueToFinding(issueInput: Issue): TraceFinding {
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

const findingSortKey = (finding: TraceFinding): string =>
  `${finding.rule_id}|${finding.location.file}|${String(finding.location.line ?? 0).padStart(10, '0')}|${finding.message}`

export interface CompileTraceOptions {
  engineVersion?: string
  ruleset?: string
  generatedAt?: string
}

/** Compile trace schema v2. Version 1 remains a separate frozen type. */
export function compileTrace(result: ScanResult, options: CompileTraceOptions = {}): TraceV3 {
  const findings = result.issues
    .map(issueToFinding)
    .sort((left, right) => findingSortKey(left).localeCompare(findingSortKey(right)))
  const checksExecuted = result.scan.checks_executed
    .map((execution) => sanitizeExecution(withFindingCount(execution, findings)))
    .sort((left, right) => `${left.kind}|${left.id}`.localeCompare(`${right.kind}|${right.id}`))

  const trace: TraceV3 = {
    schema_version: TRACE_SCHEMA_VERSION,
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
    detection: result.detection,
    findings,
    checks_executed: checksExecuted,
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
  const validation = validateTraceValue(trace)
  if (!validation.valid) {
    // Self-compiled traces are acyclic. A complexity miss on a large app must
    // still write a local trace; inbound validateTrace keeps the same cap.
    const complexityOnly = validation.errors.length === 1 && validation.errors[0] === TRACE_COMPLEXITY_ERROR
    if (!complexityOnly) throw new Error(`App Security produced an invalid trace: ${validation.errors.join('; ')}`)
  }
  return trace
}

function withFindingCount(execution: CheckExecution, findings: TraceFinding[]): CheckExecution {
  return {...execution, findings: findings.filter((finding) => finding.rule_id === execution.id).length}
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
    // Walking Object.entries().flat() treated every map key as a
    // nested visit and rejected large-but-valid apps as "cyclic".
    for (const [key, child] of Object.entries(value)) {
      if (redactText(key) !== key) containsSecret = true
      stack.push({value: child, depth: depth + 1})
    }
  }
  return {containsSecret, unsafe: false}
}

function validateFindingValue(finding: Record<string, unknown>, index: number, errors: string[]): void {
  if (!SEVERITIES.has(finding.severity as Severity)) errors.push(`findings[${index}].severity is invalid`)
  if (!validLocation(finding.location)) errors.push(`findings[${index}].location is invalid`)
  if (
    typeof finding.title !== 'string' ||
    !finding.title.trim() ||
    typeof finding.message !== 'string' ||
    !finding.message.trim() ||
    !isObject(finding.fix) ||
    typeof finding.fix.automated !== 'boolean' ||
    typeof finding.fix.description !== 'string' ||
    !finding.fix.description.trim()
  )
    errors.push(`findings[${index}] title, message, and fix are required`)
  if (
    typeof finding.rule_id !== 'string' ||
    !Number.isInteger(finding.rule_version) ||
    Number(finding.rule_version) < 1
  )
    errors.push(`findings[${index}] rule provenance is required`)
  if (
    !Array.isArray(finding.evidence) ||
    finding.evidence.some((item) => !isObject(item) || !validLocation(item.location))
  )
    errors.push(`findings[${index}].evidence is invalid`)
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
    execution.kind !== 'deterministic' ||
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
  if (status === 'executed' && ['regex', 'ast'].includes(mode) && (execution.inspected_files as unknown[]).length === 0)
    errors.push(`checks_executed[${index}] source-based execution requires inspected files`)

  if (execution.implementations !== undefined) {
    if (!Array.isArray(execution.implementations) || execution.implementations.length === 0) {
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
    !(value.project.commit === null || (typeof value.project.commit === 'string' && value.project.commit.length > 0)) ||
    !(value.project.dirty === null || typeof value.project.dirty === 'boolean')
  )
    errors.push('project commit and dirty state are required')
  if (typeof value.generated_at !== 'string' || Number.isNaN(Date.parse(value.generated_at)))
    errors.push('generated_at must be an ISO date')
  if (!validDetection(value.detection)) errors.push('detection is invalid')

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
      const actual = findings.filter((finding) => finding.rule_id === execution.id).length
      if (execution.findings !== actual) errors.push(`checks_executed[${index}].findings doesn't match findings`)
      if (
        (execution.status === 'not_applicable' || execution.status === 'unsupported_framework') &&
        (actual > 0 || Number(execution.findings) > 0)
      )
        errors.push(`checks_executed[${index}] must have zero findings for status ${String(execution.status)}`)
    })
    findings.forEach((finding, index) => {
      const execution = executions.find((candidate) => candidate.id === finding.rule_id)
      if (!execution || !['executed', 'unresolved'].includes(String(execution.status))) {
        errors.push(`findings[${index}] has no executed or partially executed check record`)
      } else if (execution.version !== finding.rule_version) {
        errors.push(`findings[${index}] provenance doesn't match its execution record`)
      }
    })
  }

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
  }
  if (inspection.containsSecret) errors.push('trace contains an unredacted matched secret')
  return {valid: errors.length === 0, errors}
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

export function assertCompatibleTrace(value: unknown): asserts value is TraceV3 {
  const validation = validateTrace(value)
  if (!validation.valid) throw new Error(`Invalid App Security trace: ${validation.errors.join('; ')}`)
}
