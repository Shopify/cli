import {
  buildReviewPack,
  compileTrace,
  formatConsole,
  formatJson,
  getEngineVersion,
  loadChecks,
  mergeFindings,
  scan,
  validateAgentChecksExecuted,
} from './app-doctor-engine/index.js'
import {computeResultHash} from './app-doctor-engine/scorer/index.js'
import {findAppRoot} from './app-doctor-engine/scanners/discover.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileSize, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {CheckExecution, Severity, Suppression} from './app-doctor-engine/types.js'
import type {AgentFindingsDocument} from './app-doctor-engine/checks/index.js'

const REVIEW_FILENAME = 'app-doctor-review.json'
const TRACE_FILENAME = 'app-doctor-trace.json'
const MAX_FINDINGS_FILE_SIZE_BYTES = 5_000_000

export interface AppDoctorEngineMetadata {
  name: string
  version: string
  ruleset: string
}

export type AppDoctorBlockingLevel = Severity | 'none'

export interface AppDoctorRunOptions {
  directory: string
  format: 'human' | 'json'
  verbose: boolean
  blocking: AppDoctorBlockingLevel
  findingsPath?: string
}

export interface AppDoctorRunResult {
  output: string
  engine: AppDoctorEngineMetadata
  exitCode: number
}

interface FindingsDocument extends AgentFindingsDocument {
  suppressions?: Suppression[]
}

const severityRank: Record<Severity, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

function shouldBlock(issues: {severity: Severity}[], blocking: AppDoctorBlockingLevel): boolean {
  if (blocking === 'none') return false
  return issues.some((issue) => severityRank[issue.severity] >= severityRank[blocking])
}

function humanScanOutput(scanOutput: string, checkCount: number, reviewPath: string, tracePath: string): string {
  return [
    scanOutput.trimEnd(),
    '',
    'Agentic review',
    `${checkCount} check(s) ready for your coding agent.`,
    `Wrote ${reviewPath}`,
    `Trace written to ${tracePath}`,
    '',
    'After investigating the review pack, compile the final trace with:',
    `  shopify app doctor --findings <findings.json>`,
  ].join('\n')
}

function humanFindingsOutput(scanOutput: string, accepted: number, rejected: string[], tracePath: string): string {
  return [
    scanOutput.trimEnd(),
    '',
    `Merged ${accepted} agent finding(s) into the trace.`,
    ...rejected.map((reason) => `Rejected: ${reason}`),
    `Trace written to ${tracePath}`,
  ].join('\n')
}

async function loadFindings(path: string): Promise<FindingsDocument> {
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

  if (!parsed || typeof parsed !== 'object' || !('findings' in parsed) || !Array.isArray(parsed.findings)) {
    throw new AbortError('The App Doctor findings file must contain a findings array.')
  }
  if ('suppressions' in parsed && parsed.suppressions !== undefined && !Array.isArray(parsed.suppressions)) {
    throw new AbortError('The App Doctor findings file suppressions field must be an array.')
  }

  return parsed as FindingsDocument
}

export async function runAppDoctor(options: AppDoctorRunOptions): Promise<AppDoctorRunResult> {
  const appRoot = findAppRoot(options.directory)
  const startTime = Date.now()
  const result = await scan(appRoot)
  const elapsedMilliseconds = Date.now() - startTime
  const engineVersion = getEngineVersion()
  const reviewPath = joinPath(appRoot, REVIEW_FILENAME)
  const tracePath = joinPath(appRoot, TRACE_FILENAME)
  let rejected: string[] = []
  let accepted = 0
  let agentChecksExecuted: CheckExecution[] = []
  let suppressions: Suppression[] = []

  if (options.findingsPath) {
    const document = await loadFindings(options.findingsPath)
    const knownFiles = new Set(Object.keys(result.scan.file_hashes ?? {}))
    const executed = validateAgentChecksExecuted(document, {detection: result.detection, knownFiles})
    const merged = mergeFindings(result.issues, document.findings, {
      knownFiles,
      executedChecks: new Set(
        executed.executions
          .filter((execution) => execution.status === 'executed' || execution.status === 'unresolved')
          .map((execution) => execution.id),
      ),
    })
    accepted = merged.accepted
    rejected = [...executed.rejected, ...merged.rejected]
    const checks = loadChecks()
    const knownCheckIds = new Set(checks.keys())
    const rejectedCheckIds = new Set(
      rejected.map((message) => message.slice(0, message.indexOf(':'))).filter((checkId) => knownCheckIds.has(checkId)),
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
          const checkId = message.slice(0, message.indexOf(':'))
          return {
            code: 'unresolved_check' as const,
            ...(knownCheckIds.has(checkId) ? {check_id: checkId} : {}),
            message: `Rejected agent result: ${message}`,
          }
        }),
      )
    }
    result.scan.result_hash = computeResultHash(result.issues, result.score)
  }

  const scanOutput = formatConsole(result, {verbose: options.verbose, elapsedMilliseconds})
  const trace = compileTrace(result, {engineVersion, agentChecksExecuted, suppressions})
  await writeFile(tracePath, `${JSON.stringify(trace, null, 2)}\n`)

  let output: string
  if (options.findingsPath) {
    output =
      options.format === 'json'
        ? JSON.stringify(trace, null, 2)
        : humanFindingsOutput(scanOutput, accepted, rejected, tracePath)
  } else {
    const reviewPack = buildReviewPack(engineVersion, result)
    await writeFile(reviewPath, `${JSON.stringify(reviewPack, null, 2)}\n`)
    output =
      options.format === 'json'
        ? formatJson(result)
        : humanScanOutput(scanOutput, reviewPack.checks.length, reviewPath, tracePath)
  }

  let exitCode = 0
  if (rejected.length > 0) exitCode = 2
  else if (shouldBlock(result.issues, options.blocking)) exitCode = 1

  return {output, engine: trace.engine, exitCode}
}
