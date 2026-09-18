import {quoteShellArgument, shellForPlatform} from './app-doctor-commands.js'
import {resolveAppDoctorContext, type ResolveAppDoctorContextOptions} from './app-doctor-context.js'
import {
  ENGINE_NAME,
  getAppDoctorResultOutcome,
  getEngineVersion,
  loadChecks,
  prepareAppDoctorRecord,
  replaceAppDoctorResults,
} from './app-doctor-engine/index.js'
import {appDoctorRecordJsonOutputSchema, type AppDoctorRecordResult} from './app-doctor-record-json.js'
import {readAppDoctorStoredResults, toImmediateDiagnostic} from './app-doctor-stored-results.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, fileSize, readFile} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import type {
  AppDoctorContext,
  AppDoctorInterpretation,
  AppDoctorRecordProblem,
  AppDoctorRecordScope,
  AppDoctorRecordSubmission,
  AppDoctorResult,
  AppDoctorResultBatch,
  AppDoctorResultReceipt,
  AppDoctorStoreDiagnostic,
  Check,
  AppDoctorWriterMode,
} from './app-doctor-engine/index.js'

export type AppDoctorRecordFormat = 'json' | 'text'

export interface AppDoctorRecordOptions {
  readonly directory?: string
  readonly configName?: string
  readonly clientId?: string
  /** Review tokens, paired with `findings` by position. */
  readonly reviews: string[]
  /** Absolute paths to the agent's findings documents, paired with `reviews` by position. */
  readonly findings: string[]
  /** Decided by the caller (typically `isTerminalInteractive()`); prompts are only shown when true. */
  readonly interactive: boolean
}

export interface AppDoctorRecordDependencies {
  resolveContext(options: ResolveAppDoctorContextOptions): Promise<AppDoctorContext>
  /** The clock behind `produced_at`; injected so tests can pin timestamps. */
  now(): Date
  /** The store writer; injected so tests can tune its publication guard. */
  replaceAppDoctorResults(
    context: AppDoctorContext,
    writerMode: AppDoctorWriterMode,
    entries: ReadonlyArray<AppDoctorResult>,
  ): Promise<AppDoctorResultBatch>
  /** The check catalogue the review tokens are verified against; must match the one the instructions used. */
  loadChecks(): ReadonlyMap<string, Check>
}

const defaultDependencies: AppDoctorRecordDependencies = {
  resolveContext: resolveAppDoctorContext,
  now: () => new Date(),
  replaceAppDoctorResults: (context, writerMode, entries) => replaceAppDoctorResults(context, writerMode, entries),
  loadChecks,
}

/** Findings documents are a few kilobytes per check; anything near this bound is not a findings document. */
export const MAX_FINDINGS_FILE_BYTES = 5_000_000

const REGENERATE_TRY_MESSAGE =
  'Regenerate the instructions with `shopify app doctor instructions`, have the agent review again, and re-run `shopify app doctor record` with the new tokens.'
const FIX_DOCUMENT_TRY_MESSAGE = 'Fix the findings documents and re-run `shopify app doctor record`.'
const FINDINGS_PATH_TRY_MESSAGE = 'Pass --findings with the path the agent wrote its findings document to.'

/** Problems that only regenerating the instructions can resolve; document edits alone cannot. */
const REGENERATE_PROBLEM_CODES = new Set<RecordRejection['code']>([
  'invalid_token',
  'foreign_configuration',
  'stale_check',
  'document_token_mismatch',
])

type RecordedStatus = 'created' | 'replaced'

type FindingsFileProblemCode =
  | 'findings_file_missing'
  | 'findings_file_unreadable'
  | 'findings_file_too_large'
  | 'findings_file_not_json'

/** Problems with the findings files the caller passed; codes that only a corrected path can resolve. */
const FINDINGS_PATH_PROBLEM_CODES = new Set<RecordRejection['code']>([
  'findings_file_missing',
  'findings_file_unreadable',
  'findings_file_too_large',
])

/** Everything that can stop a record: a findings file the CLI could not use, or a problem the engine reported. */
interface RecordRejection {
  readonly code: AppDoctorRecordProblem['code'] | FindingsFileProblemCode
  readonly message: string
  /** Zero-based position of the offending `--review`/`--findings` pair. */
  readonly submission: number
  readonly check_id?: string
}

type FindingsFileRead =
  | {readonly ok: true; readonly document: unknown}
  | {readonly ok: false; readonly problem: RecordRejection}

interface Publication {
  readonly statuses: ReadonlyMap<string, RecordedStatus>
  readonly warnings: ReadonlyArray<AppDoctorStoreDiagnostic>
}

const ownerKey = (scopeIdentity: string, checkId: string) => JSON.stringify([scopeIdentity, checkId])

function assertPairedSubmissions(options: AppDoctorRecordOptions): void {
  if (options.reviews.length === 0) {
    throw new AbortError(
      'No --review token was given, so there is nothing to record.',
      'Pass at least one --review token together with its --findings file, exactly as the instructions list them.',
    )
  }
  if (options.reviews.length !== options.findings.length) {
    throw new AbortError(
      `Received ${options.reviews.length} --review ${plural(options.reviews.length, 'token')} but ${
        options.findings.length
      } --findings ${plural(options.findings.length, 'file')}.`,
      'Pass one --findings file for each --review token, in the same order as the tokens.',
    )
  }
}

function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`
}

/** Node filesystem failures carry a `syscall`; anything else is a programmer error and must propagate. */
const isFileSystemError = (error: unknown): boolean => typeof error === 'object' && error !== null && 'syscall' in error

/** Read and decode one findings file; every failure becomes a rejection so the caller can report them all at once. */
async function readFindingsDocument(path: string, submission: number): Promise<FindingsFileRead> {
  const rejected = (code: FindingsFileProblemCode, message: string): FindingsFileRead => ({
    ok: false,
    problem: {code, message, submission},
  })
  if (!(await fileExists(path))) return rejected('findings_file_missing', `Findings file not found: ${path}`)
  let content: string
  try {
    const size = await fileSize(path)
    if (size > MAX_FINDINGS_FILE_BYTES) {
      return rejected(
        'findings_file_too_large',
        `Findings file is too large (${size.toLocaleString('en-US')} bytes, limit ${MAX_FINDINGS_FILE_BYTES.toLocaleString(
          'en-US',
        )}): ${path}. A findings document is a small JSON file; make sure --findings points at the document the agent wrote.`,
      )
    }
    content = await readFile(path)
  } catch (error) {
    if (!isFileSystemError(error)) throw error
    // Covers a directory, a permission problem, or a file that vanished between the checks above and the read.
    return rejected('findings_file_unreadable', `Findings file could not be read: ${path}`)
  }
  try {
    return {ok: true, document: JSON.parse(content)}
  } catch (error) {
    if (error instanceof SyntaxError)
      return rejected('findings_file_not_json', `Findings file is not valid JSON: ${path}`)
    throw error
  }
}

function describeProblem(problem: RecordRejection): string {
  const check = problem.check_id === undefined ? '' : ` [${problem.check_id}]`
  return `- Submission ${problem.submission + 1} (${problem.code})${check}: ${problem.message}`
}

/** Regeneration outranks a wrong path, which outranks a document edit: fixing the former makes the rest moot. */
function tryMessageFor(problems: ReadonlyArray<RecordRejection>): string {
  if (problems.some((problem) => REGENERATE_PROBLEM_CODES.has(problem.code))) return REGENERATE_TRY_MESSAGE
  if (problems.some((problem) => FINDINGS_PATH_PROBLEM_CODES.has(problem.code))) return FINDINGS_PATH_TRY_MESSAGE
  return FIX_DOCUMENT_TRY_MESSAGE
}

function rejectRecord(problems: ReadonlyArray<RecordRejection>): never {
  const ordered = [...problems].sort((left, right) => left.submission - right.submission)
  throw new AbortError(
    `The App Doctor review can't be recorded. Nothing was stored.\n${ordered.map(describeProblem).join('\n')}`,
    tryMessageFor(problems),
  )
}

/**
 * Read every findings file, then let the engine validate the readable ones,
 * so one unreadable file does not hide the problems in the others. Engine
 * problems index the subset it saw and are mapped back to the caller's pairs.
 */
async function prepareSubmissions(
  context: AppDoctorContext,
  options: AppDoctorRecordOptions,
  producedAt: string,
  checks: ReadonlyMap<string, Check>,
): Promise<{entries: ReadonlyArray<AppDoctorResult>; scopes: ReadonlyArray<AppDoctorRecordScope>}> {
  const reads = await Promise.all(options.findings.map((path, index) => readFindingsDocument(path, index)))
  const fileProblems = reads.flatMap((read) => (read.ok ? [] : [read.problem]))
  const readable = reads.flatMap((read, index) => {
    if (!read.ok) return []
    const submission: AppDoctorRecordSubmission = {
      token: options.reviews[index]!,
      document: read.document,
      documentLabel: options.findings[index]!,
    }
    return [{index, submission}]
  })
  const preparation = prepareAppDoctorRecord({
    configurationIdentity: context.configurationIdentity,
    submissions: readable.map((entry) => entry.submission),
    checks,
    engine: {name: ENGINE_NAME, version: getEngineVersion()},
    producedAt,
  })
  if (preparation.status === 'rejected') {
    const engineProblems = preparation.problems.map((problem) => ({
      ...problem,
      submission: readable[problem.submission]!.index,
    }))
    rejectRecord([...fileProblems, ...engineProblems])
  }
  if (fileProblems.length > 0) rejectRecord(fileProblems)
  return {entries: preparation.entries, scopes: preparation.scopes}
}

const describeDiagnostic = (diagnostic: AppDoctorStoreDiagnostic): string =>
  `- ${diagnostic.code}: ${diagnostic.message} (${diagnostic.path})`

function describeReceipt(receipt: AppDoctorResultReceipt): string {
  const owner = `${receipt.key.checkId} in scope ${receipt.key.scopeIdentity}`
  if (receipt.status === 'failed') {
    return `- ${owner}: failed\n${receipt.diagnostics.map((diagnostic) => `  ${describeDiagnostic(diagnostic)}`).join('\n')}`
  }
  return `- ${owner}: ${receipt.status}`
}

/** Convert the store's batch outcome into per-owner statuses, or explain exactly what did and did not get written. */
function publicationOf(batch: AppDoctorResultBatch): Publication {
  if (batch.status === 'rejected') {
    throw new AbortError(
      `App Doctor could not store the agent results. Nothing was written.\n${batch.diagnostics
        .map(describeDiagnostic)
        .join('\n')}`,
      'This is unexpected for freshly prepared results; re-run `shopify app doctor record` and report the problem if it persists.',
    )
  }
  if (batch.status === 'partial') {
    throw new AbortError(
      `App Doctor stored only part of the agent review. The store now mixes new and previous results:\n${batch.receipts
        .map(describeReceipt)
        .join('\n')}`,
      'Re-run `shopify app doctor record` with the same tokens and findings to complete the review.',
    )
  }
  const statuses = new Map<string, RecordedStatus>()
  const warnings: AppDoctorStoreDiagnostic[] = []
  for (const receipt of batch.receipts) {
    // A `complete` batch only holds published receipts; the other statuses cannot occur here.
    if (receipt.status !== 'created' && receipt.status !== 'replaced' && receipt.status !== 'unchanged') continue
    // Every entry carries a fresh `produced_at`, so the store never finds identical bytes; should it ever, the
    // review was still re-recorded, which is what `replaced` tells the caller.
    statuses.set(
      ownerKey(receipt.key.scopeIdentity, receipt.key.checkId),
      receipt.status === 'created' ? 'created' : 'replaced',
    )
    warnings.push(...receipt.warnings)
  }
  return {statuses, warnings}
}

/** Read the store back after publishing; publication warnings follow the store's own diagnostics. */
async function interpretStore(
  context: AppDoctorContext,
  publication: Publication,
): Promise<{interpretation: AppDoctorInterpretation; directories: ReadonlyMap<string, string>}> {
  const {interpretation, directories} = await readAppDoctorStoredResults(
    context,
    publication.warnings.map(toImmediateDiagnostic('record')),
  )
  return {interpretation, directories}
}

function recordedScopes(
  scopes: ReadonlyArray<AppDoctorRecordScope>,
  entries: ReadonlyArray<AppDoctorResult>,
  publication: Publication,
  directories: ReadonlyMap<string, string>,
): AppDoctorRecordResult['recorded'] {
  const entriesByOwner = new Map(entries.map((entry) => [ownerKey(entry.scope_identity, entry.check_id), entry]))
  return scopes.map((scope) => {
    const directory = directories.get(scope.scope_identity)
    return {
      scope_identity: scope.scope_identity,
      ...(directory === undefined ? {} : {directory}),
      checks: scope.check_ids.map((checkId) => {
        const key = ownerKey(scope.scope_identity, checkId)
        const entry = entriesByOwner.get(key)
        const status = publication.statuses.get(key)
        // Every prepared entry was published in a `complete` batch, so both lookups succeed by construction.
        if (entry === undefined || status === undefined) {
          throw new AbortError(`App Doctor lost track of check ${checkId} while recording.`)
        }
        const outcome = getAppDoctorResultOutcome(entry)
        if (outcome === 'not_run' || outcome === 'unsupported_framework') {
          throw new AbortError(`App Doctor produced an unexpected ${outcome} outcome for check ${checkId}.`)
        }
        return {check_id: checkId, outcome, finding_count: entry.findings.length, status}
      }),
    }
  })
}

function summaryOf(interpretation: AppDoctorInterpretation): AppDoctorRecordResult['summary'] {
  const {score} = interpretation
  return {
    scopes: interpretation.scopes.length,
    findings: interpretation.findings.length,
    suppressed_findings: interpretation.suppressions.suppressedFindings,
    score:
      score.status === 'graded'
        ? {status: 'graded', total: score.total, grade: score.grade}
        : {status: 'withheld', reason: score.reason},
    static_coverage_complete: interpretation.coverage.complete,
  }
}

function statusCommand(context: AppDoctorContext): string {
  const shell = shellForPlatform()
  const quote = (value: string) => quoteShellArgument(value, shell)
  return `shopify app doctor status --path ${quote(context.appRoot)} --config ${quote(context.configurationFileName)}`
}

/**
 * Record a coding agent's review as agent results in the store and read the
 * store back. Nothing is printed. No scan, declaration, or prior result is
 * required: each review token carries the owner, scope, and check provenance.
 * Re-recording is a new review: every result gets a fresh `produced_at` and
 * replaces what the store held.
 */
export async function recordAppDoctorReview(
  options: AppDoctorRecordOptions,
  dependencies: AppDoctorRecordDependencies = defaultDependencies,
): Promise<AppDoctorRecordResult> {
  assertPairedSubmissions(options)
  const context = await dependencies.resolveContext({
    directory: options.directory,
    configName: options.configName,
    clientId: options.clientId,
    interactive: options.interactive,
  })

  const {entries, scopes} = await prepareSubmissions(
    context,
    options,
    dependencies.now().toISOString(),
    dependencies.loadChecks(),
  )
  const publication = publicationOf(await dependencies.replaceAppDoctorResults(context, 'agent', entries))
  const {interpretation, directories} = await interpretStore(context, publication)

  return {
    schema_version: 1,
    configuration: {
      identity: context.configurationIdentity,
      path: context.configurationPath,
      name: context.configurationFileName,
      ...(context.clientId === undefined ? {} : {client_id: context.clientId}),
    },
    app_root: context.appRoot,
    recorded: recordedScopes(scopes, entries, publication, directories),
    summary: summaryOf(interpretation),
    diagnostics: interpretation.diagnostics.map((diagnostic) => ({
      source: diagnostic.source,
      code: diagnostic.code,
      message: diagnostic.message,
      ...(diagnostic.path === undefined ? {} : {path: diagnostic.path}),
    })),
    next: statusCommand(context),
  }
}

function describeScore(score: AppDoctorRecordResult['summary']['score']): string {
  if (score.status === 'graded') return `score ${score.total} (${score.grade})`
  return `score withheld (${score.reason.replace(/_/g, ' ')})`
}

function renderText(result: AppDoctorRecordResult): void {
  if (result.diagnostics.length > 0) {
    renderWarning({
      headline: 'App Doctor reported problems while reading the result store.',
      body: [
        {
          list: {
            items: result.diagnostics.map(
              (diagnostic) =>
                `${diagnostic.code}: ${diagnostic.message}${diagnostic.path === undefined ? '' : ` (${diagnostic.path})`}`,
            ),
          },
        },
      ],
    })
  }
  const {summary} = result
  renderSuccess({
    headline: `Recorded App Doctor agent review for ${result.configuration.name}`,
    body: [
      ...result.recorded.map((scope) => ({
        list: {
          title: scope.directory ?? scope.scope_identity,
          items: scope.checks.map(
            (check) =>
              `${check.check_id}: ${check.outcome} (${check.finding_count} ${plural(check.finding_count, 'finding')})`,
          ),
        },
      })),
      `Stored results now cover ${summary.scopes} ${plural(summary.scopes, 'scope')}: ${summary.findings} ${plural(
        summary.findings,
        'finding',
      )} (${summary.suppressed_findings} suppressed), ${describeScore(summary.score)}.`,
      'The review is stored for this configuration; no rescan was performed. Static scanning is separate and its results are unchanged.',
    ],
    nextSteps: [['Read the stored results back with', {command: result.next}]],
  })
}

/** Presenter: JSON goes to stdout exactly once; text renders banners on stderr and writes nothing to stdout. */
export function writeAppDoctorRecordResult(result: AppDoctorRecordResult, format: AppDoctorRecordFormat): void {
  if (format === 'json') {
    outputResult(appDoctorRecordJsonOutputSchema.encode(result))
    return
  }
  renderText(result)
}
