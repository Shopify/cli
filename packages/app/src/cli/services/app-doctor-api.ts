import {
  AppRootDiscoveryError,
  buildReviewPack,
  compileTrace,
  computeResultHash,
  FINDINGS_SCHEMA_VERSION,
  findAppRoot,
  getEngineVersion,
  loadChecks,
  mergeFindings,
  scan,
  searchBoundaryFiles,
  validateAgentChecksExecuted,
  type AgentFindingsDocument,
  type CheckExecution,
  type ReviewPack,
  type ScanResult,
  type Severity,
  type Suppression,
  type TraceV2,
} from './app-doctor-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileSize, readFile} from '@shopify/cli-kit/node/fs'

const MAX_FINDINGS_FILE_SIZE_BYTES = 5_000_000

export interface AppDoctorEngineMetadata {
  name: string
  version: string
  ruleset: string
}

export type AppDoctorBlockingLevel = Severity | 'none'

export interface AppDoctorFindings {
  accepted: number
  rejected: string[]
  warnings: string[]
}

export type AppDoctorExecution =
  | {
      operation: 'scan'
      appRoot: string
      scan: ScanResult
      trace: TraceV2
      reviewPack: ReviewPack
      engine: AppDoctorEngineMetadata
      elapsedMilliseconds: number
    }
  | {
      operation: 'compile'
      appRoot: string
      scan: ScanResult
      trace: TraceV2
      findings: AppDoctorFindings
      engine: AppDoctorEngineMetadata
      elapsedMilliseconds: number
    }

interface FindingsDocument extends AgentFindingsDocument {
  schema_version: typeof FINDINGS_SCHEMA_VERSION
  source_scan_id: string
  suppressions?: Suppression[]
}

const severityRank: Record<Severity, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export function doctorExitCode(execution: AppDoctorExecution, blocking: AppDoctorBlockingLevel): number {
  if (execution.operation === 'compile' && execution.findings.rejected.length > 0) return 2
  if (shouldBlock(execution.scan.issues, blocking)) return 1
  return 0
}

function shouldBlock(issues: {severity: Severity}[], blocking: AppDoctorBlockingLevel): boolean {
  if (blocking === 'none') return false
  return issues.some((issue) => severityRank[issue.severity] >= severityRank[blocking])
}

function checkIdFromRejection(message: string, knownCheckIds: Set<string>): string | undefined {
  const delimiter = message.indexOf(':')
  if (delimiter <= 0) return undefined
  const checkId = message.slice(0, delimiter)
  return knownCheckIds.has(checkId) ? checkId : undefined
}

export async function loadAppDoctorFindings(path: string): Promise<FindingsDocument> {
  let content: string
  try {
    const size = await fileSize(path)
    if (size > MAX_FINDINGS_FILE_SIZE_BYTES) {
      throw new AbortError(`Could not read App Doctor findings from ${path}.`, 'The file is larger than 5 MB.')
    }
    content = await readFile(path)
  } catch (error) {
    if (error instanceof AbortError) throw error
    throw new AbortError(
      `Could not read App Doctor findings from ${path}.`,
      error instanceof Error ? error.message : undefined,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new AbortError(
      `Could not parse App Doctor findings from ${path}.`,
      error instanceof Error ? error.message : undefined,
    )
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new AbortError('The App Doctor findings file must contain a JSON object.')
  }
  if (!('schema_version' in parsed) || parsed.schema_version !== FINDINGS_SCHEMA_VERSION) {
    throw new AbortError(
      `The App Doctor findings file must use schema version ${FINDINGS_SCHEMA_VERSION}.`,
      'Generate a new review pack and use its findings schema.',
    )
  }
  if (!('source_scan_id' in parsed) || typeof parsed.source_scan_id !== 'string' || !parsed.source_scan_id) {
    throw new AbortError(
      'The App Doctor findings file must identify its source scan.',
      'Copy the source_scan_id from the generated review.json.',
    )
  }
  if (!('findings' in parsed) || !Array.isArray(parsed.findings)) {
    throw new AbortError('The App Doctor findings file must contain a findings array.')
  }
  if ('suppressions' in parsed && parsed.suppressions !== undefined && !Array.isArray(parsed.suppressions)) {
    throw new AbortError('The App Doctor findings file suppressions field must be an array.')
  }

  return parsed as FindingsDocument
}

export function resolveAppDoctorRoot(directory?: string): string {
  try {
    return findAppRoot(directory)
  } catch (error) {
    if (error instanceof AppRootDiscoveryError) {
      throw new AbortError(error.message, 'Run this command from a Shopify app directory or pass --path to one.')
    }
    throw error
  }
}

export async function executeAppDoctor(options: {
  appRoot: string
  findings?: FindingsDocument
}): Promise<AppDoctorExecution> {
  const startTime = Date.now()
  const result = await scan(options.appRoot)
  const elapsedMilliseconds = Date.now() - startTime
  const engineVersion = getEngineVersion()
  let agentChecksExecuted: CheckExecution[] = []
  let suppressions: Suppression[] = []

  if (!options.findings) {
    const reviewPack = buildReviewPack(engineVersion, result)
    const trace = compileTrace(result, {engineVersion, agentChecksExecuted, suppressions})
    return {
      operation: 'scan',
      appRoot: options.appRoot,
      scan: result,
      trace,
      reviewPack,
      engine: trace.engine,
      elapsedMilliseconds,
    }
  }

  const document = options.findings
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
  const rejected = [...executed.rejected, ...merged.rejected]
  const warnings = executed.warnings
  const checks = loadChecks()
  const knownCheckIds = new Set(checks.keys())
  const rejectedCheckIds = new Set(
    rejected.flatMap((message) => {
      const checkId = checkIdFromRejection(message, knownCheckIds)
      return checkId ? [checkId] : []
    }),
  )
  agentChecksExecuted = executed.executions.map((execution) =>
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
  suppressions = document.suppressions ?? []
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
    appRoot: options.appRoot,
    scan: result,
    trace,
    findings: {accepted, rejected, warnings},
    engine: trace.engine,
    elapsedMilliseconds,
  }
}
