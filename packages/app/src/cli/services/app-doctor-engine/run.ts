import {EMBEDDED_APP_DOCTOR_INSTRUCTIONS} from './checks/embedded.js'
import {
  buildReviewPack,
  loadChecks,
  mergeFindings,
  searchBoundaryFiles,
  validateAgentChecksExecuted,
  type AgentFindingsDocument,
  type ReviewPack,
} from './checks/index.js'
import {redactText} from './rules/secret-rules.js'
import {AppRootDiscoveryError, findAppRoot} from './scanners/discover.js'
import {scan} from './scanners/index.js'
import {computeResultHash} from './scorer/index.js'
import {compileTrace, validateTrace} from './trace/index.js'
import {FINDINGS_SCHEMA_VERSION} from './types.js'
import {getEngineVersion} from './version.js'
import type {CheckExecution, ScanResult, Suppression, TraceV2} from './types.js'

export {AppRootDiscoveryError, findAppRoot}

const SOURCE_SCAN_ID = /^sha256:[0-9a-f]{64}$/

export interface AppDoctorEngineMetadata {
  name: string
  version: string
  ruleset: string
}

export interface AppDoctorFindings {
  accepted: number
  rejected: string[]
  warnings: string[]
}

export interface FindingsDocument extends AgentFindingsDocument {
  schema_version: typeof FINDINGS_SCHEMA_VERSION
  source_scan_id: string
  suppressions?: Suppression[]
}

export interface AppDoctorScan {
  operation: 'scan'
  appRoot: string
  scan: ScanResult
  trace: TraceV2
  reviewPack: ReviewPack
  engine: AppDoctorEngineMetadata
}

export interface AppDoctorCompile {
  operation: 'compile'
  appRoot: string
  scan: ScanResult
  trace: TraceV2
  findings: AppDoctorFindings
  engine: AppDoctorEngineMetadata
}

export type ParseTraceResult = {ok: true; trace: TraceV2} | {ok: false; errors: string[]}

/** Expected user error while reading an agent findings document. */
export class FindingsDocumentError extends Error {
  readonly tryMessage?: string

  constructor(message: string, tryMessage?: string) {
    super(message)
    this.name = 'FindingsDocumentError'
    this.tryMessage = tryMessage
  }
}

export function getAgentInstructions(): string {
  return EMBEDDED_APP_DOCTOR_INSTRUCTIONS
}

export function parseTrace(value: unknown): ParseTraceResult {
  const validation = validateTrace(value)
  return validation.valid ? {ok: true, trace: value as TraceV2} : {ok: false, errors: validation.errors}
}

export function parseFindings(value: unknown): FindingsDocument {
  if (!value || typeof value !== 'object') {
    throw new FindingsDocumentError('The App Doctor findings file must contain a JSON object.')
  }
  if (!('schema_version' in value) || value.schema_version !== FINDINGS_SCHEMA_VERSION) {
    throw new FindingsDocumentError(
      `The App Doctor findings file must use schema version ${FINDINGS_SCHEMA_VERSION}.`,
      'Generate a new review pack and use its findings schema.',
    )
  }
  if (
    !('source_scan_id' in value) ||
    typeof value.source_scan_id !== 'string' ||
    !SOURCE_SCAN_ID.test(value.source_scan_id)
  ) {
    throw new FindingsDocumentError(
      'The App Doctor findings file must identify its source scan.',
      'Copy the source_scan_id from the generated review.json.',
    )
  }
  if (!('findings' in value) || !Array.isArray(value.findings)) {
    throw new FindingsDocumentError('The App Doctor findings file must contain a findings array.')
  }
  if ('suppressions' in value && value.suppressions !== undefined && !Array.isArray(value.suppressions)) {
    throw new FindingsDocumentError('The App Doctor findings file suppressions field must be an array.')
  }

  return value as FindingsDocument
}

export async function scanApp(directory?: string): Promise<AppDoctorScan> {
  const appRoot = findAppRoot(directory)
  const result = await scan(appRoot)
  const engineVersion = getEngineVersion()
  const reviewPack = buildReviewPack(engineVersion, result)
  const trace = compileTrace(result, {engineVersion, agentChecksExecuted: [], suppressions: []})
  return {
    operation: 'scan',
    appRoot,
    scan: result,
    trace,
    reviewPack,
    engine: trace.engine,
  }
}

export async function compileFindings(directory: string, document: FindingsDocument): Promise<AppDoctorCompile> {
  const appRoot = findAppRoot(directory)
  const result = await scan(appRoot)
  const engineVersion = getEngineVersion()
  const knownFiles = new Set(searchBoundaryFiles(result))
  const provenanceRejected =
    document.source_scan_id === result.scan.input_hash
      ? []
      : [`Findings source scan ${document.source_scan_id} does not match the current scan ${result.scan.input_hash}.`]
  const executed =
    provenanceRejected.length > 0
      ? {executions: [] as CheckExecution[], rejected: provenanceRejected, warnings: [] as string[]}
      : validateAgentChecksExecuted(document, {detection: result.detection, knownFiles})
  const merged =
    provenanceRejected.length > 0
      ? {accepted: 0, rejected: [] as string[]}
      : mergeFindings(result.issues, document.findings, {
          knownFiles,
          executedChecks: new Set(
            executed.executions
              .filter((execution) => execution.status === 'executed' || execution.status === 'unresolved')
              .map((execution) => execution.id),
          ),
        })
  const accepted = merged.accepted
  const rejected = [...executed.rejected, ...merged.rejected].map((message) => redactText(message))
  const warnings = executed.warnings.map((message) => redactText(message))
  const checks = loadChecks()
  const knownCheckIds = new Set(checks.keys())
  const rejectedCheckIds = new Set(
    rejected.flatMap((message) => {
      const checkId = checkIdFromRejection(message, knownCheckIds)
      return checkId ? [checkId] : []
    }),
  )
  const agentChecksExecuted: CheckExecution[] = executed.executions.map((execution) =>
    rejectedCheckIds.has(execution.id)
      ? {
          ...execution,
          status: 'unresolved',
          applicable: true,
          reason: {
            code: 'input_rejected',
            message: `One or more submitted results for ${execution.id} were rejected.`,
          },
          guidance: 'Correct the rejected check record or findings, then compile the trace again.',
        }
      : execution,
  )
  for (const checkId of rejectedCheckIds) {
    if (agentChecksExecuted.some((execution) => execution.id === checkId)) continue
    const check = checks.get(checkId)!
    agentChecksExecuted.push({
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
      findings: 0,
      analysis_mode: 'agent',
      reason: {code: 'input_rejected', message: `The submitted execution or findings for ${check.id} were rejected.`},
      prompt: check.prompt,
      prompt_hash: check.prompt_hash,
      guidance: 'Correct the rejected check record or findings, then compile the trace again.',
    })
  }
  // Stale documents must not suppress current findings or crash compile when fingerprints no longer exist.
  const suppressions = provenanceRejected.length > 0 ? [] : (document.suppressions ?? [])
  if (rejected.length > 0) {
    result.score = null
    result.scan.coverage_complete = false
    result.scan.coverage_gaps.push(
      ...rejected.map((message) => {
        const checkId = checkIdFromRejection(message, knownCheckIds)
        return {
          code: 'unresolved_check' as const,
          ...(checkId ? {check_id: checkId} : {}),
          message: `Rejected agent result: ${message}`,
        }
      }),
    )
  }
  result.scan.result_hash = computeResultHash(result.issues, result.score)

  const trace = compileTrace(result, {engineVersion, agentChecksExecuted, suppressions})
  return {
    operation: 'compile',
    appRoot,
    scan: result,
    trace,
    findings: {accepted, rejected, warnings},
    engine: trace.engine,
  }
}

function checkIdFromRejection(message: string, knownCheckIds: Set<string>): string | undefined {
  const delimiter = message.indexOf(':')
  if (delimiter <= 0) return undefined
  const checkId = message.slice(0, delimiter)
  return knownCheckIds.has(checkId) ? checkId : undefined
}
