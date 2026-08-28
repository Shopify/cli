import {
  buildReviewPack,
  compileTrace,
  formatConsole,
  formatJson,
  getEngineVersion,
  mergeFindings,
  scan,
  validateAgentChecksExecuted,
} from './app-doctor-engine/index.js'
import {computeResultHash} from './app-doctor-engine/scorer/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {CheckExecution, Severity, Suppression} from './app-doctor-engine/types.js'
import type {AgentFindingsDocument} from './app-doctor-engine/checks/index.js'

const REVIEW_FILENAME = 'app-doctor-review.json'
const TRACE_FILENAME = 'app-doctor-trace.json'

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
  critical: 4,
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
    `  shopify app doctor scan --findings <findings.json>`,
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
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(path))
  } catch (error) {
    throw new AbortError(
      `Could not read App Doctor findings from ${path}.`,
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
  const startTime = Date.now()
  const result = await scan(options.directory)
  const elapsedMilliseconds = Date.now() - startTime
  const engineVersion = getEngineVersion()
  const reviewPath = joinPath(options.directory, REVIEW_FILENAME)
  const tracePath = joinPath(options.directory, TRACE_FILENAME)
  const scanOutput = formatConsole(result, {verbose: options.verbose, elapsedMilliseconds})

  let rejected: string[] = []
  let accepted = 0
  let agentChecksExecuted: CheckExecution[] = []
  let suppressions: Suppression[] = []

  if (options.findingsPath) {
    const document = await loadFindings(options.findingsPath)
    const merged = mergeFindings(result.issues, document.findings, {
      knownFiles: new Set(Object.keys(result.scan.file_hashes ?? {})),
    })
    const executed = validateAgentChecksExecuted(document)
    accepted = merged.accepted
    rejected = [...merged.rejected, ...executed.rejected]
    agentChecksExecuted = executed.executions
    suppressions = document.suppressions ?? []
    result.scan.result_hash = computeResultHash(result.issues, result.score)
  }

  const trace = compileTrace(result, {engineVersion, agentChecksExecuted, suppressions})
  await writeFile(tracePath, `${JSON.stringify(trace, null, 2)}\n`)

  let output: string
  if (options.findingsPath) {
    output =
      options.format === 'json'
        ? JSON.stringify(trace, null, 2)
        : humanFindingsOutput(scanOutput, accepted, rejected, tracePath)
  } else {
    const reviewPack = buildReviewPack(engineVersion)
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
