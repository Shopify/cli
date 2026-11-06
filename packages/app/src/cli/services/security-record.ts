import {
  appSecuritySuppressionsPath,
  encodedArtifactSize,
  MAX_ARTIFACT_FILE_SIZE_BYTES,
  writeAgentFindings,
} from './app-security-artifacts.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {recordAppSecurityMetadata, type AppSecurityMetadata} from './app-security-metadata.js'
import {
  createCitedFileReader,
  getEngineVersion,
  recordAgentFindings,
  withoutCodeExcerpts,
  type AgentFindingsDocument,
  type StoredFinding,
} from './app-security-engine/index.js'
import {resultsKey, type AppSecuritySelection} from './app-security-selection.js'
import {
  planSuppression,
  readAppSecuritySuppressions,
  saveAppSecuritySuppressions,
  suppressionConfiguration,
  type AppSecuritySuppression,
  type SavedSuppression,
  type SuppressionChange,
  type SuppressionResults,
} from './app-security-suppressions.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readStdinString} from '@shopify/cli-kit/node/system'
import type {AppSecurityCommands} from './app-security-commands.js'

const MAX_FINDINGS_DOCUMENT_BYTES = 5_000_000

/** A recorded findings document: where it was written and what it holds. */
export interface SecurityRecordResult {
  path: string
  checks: number
  findings: number
  /** How the agent's suppressions were saved to shopify.app-security.json, or null when the document has none. */
  suppressions: RecordedSuppressions | null
}

/** The agent's suppressions, each saved to shopify.app-security.json, already there, or not saved with the reason. */
export interface RecordedSuppressions {
  /** The absolute path of shopify.app-security.json. */
  path: string
  saved: SavedSuppression[]
  /** The number of suppressions that an entry of the file already held, so the file didn't change for them. */
  alreadySaved: number
  notSaved: {checkId: string; location: StoredFinding['location']; problem: string}[]
}

export interface SecurityRecordOptions {
  selection: AppSecuritySelection
  /** The `--path` value that was typed. */
  path: string
}

export interface SecurityRecordDependencies {
  readStdin(): Promise<string | undefined>
  engineVersion(): string
  writeAgentFindings(appDirectory: string, resultsKey: string, document: AgentFindingsDocument): Promise<string>
  recordMetadata(fields: AppSecurityMetadata): Promise<void>
}

const defaultDependencies: SecurityRecordDependencies = {
  readStdin: readStdinString,
  engineVersion: getEngineVersion,
  writeAgentFindings,
  recordMetadata: recordAppSecurityMetadata,
}

function recordCommand(commands: AppSecurityCommands): string {
  return formatAppSecurityCommand(commands.record)
}

/** Rejects a document that fails validation, listing every error so an agent can fix them all at once. */
function abortRejectedDocument(errors: string[], commands: AppSecurityCommands): never {
  const error = new AbortError(
    'The findings document was rejected. Nothing was recorded.',
    null,
    [['Fix every error, then run', {command: recordCommand(commands)}, 'again.']],
    [{title: 'Errors', body: {list: {items: errors}}}],
  )
  error.code = 'findings-document-rejected'
  error.details = {errors}
  throw error
}

async function readStdinDocument(
  commands: AppSecurityCommands,
  dependencies: SecurityRecordDependencies,
): Promise<string | undefined> {
  try {
    return await dependencies.readStdin()
  } catch (error) {
    // readStdinString aborts past its own 10 MB limit; report that like any other rejection.
    if (error instanceof AbortError) abortRejectedDocument([error.message], commands)
    throw error
  }
}

/** The agent's record input, parsed from stdin. Not a stored findings document: `recordAgentFindings` validates it. */
async function readInputDocument(
  commands: AppSecurityCommands,
  dependencies: SecurityRecordDependencies,
): Promise<unknown> {
  const input = await readStdinDocument(commands, dependencies)
  if (input === undefined) {
    const error = new AbortError('No findings document was piped on stdin.', null, [
      ['Pipe the findings document on stdin:', {command: recordCommand(commands)}],
    ])
    error.code = 'findings-document-missing'
    throw error
  }

  const size = Buffer.byteLength(input, 'utf8')
  if (size > MAX_FINDINGS_DOCUMENT_BYTES) {
    abortRejectedDocument([`The findings document is ${size} bytes; the limit is 5 MB.`], commands)
  }

  try {
    return JSON.parse(input)
    // The document is untrusted agent output; any parse failure is a rejection.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    abortRejectedDocument([`The findings document is not valid JSON: ${message}`], commands)
  }
}

/** What `check` scans without `--include-dir`: the app directory, and the extension and web directories outside it. */
function citedFileDirectories(selection: AppSecuritySelection): string[] {
  return [selection.appDirectory, ...(selection.kind === 'config' ? (selection.appConfigDirectories ?? []) : [])]
}

/**
 * Validates the agent's findings document from stdin and, only if it is fully valid, replaces
 * agent-findings.json. Each finding gets the redacted lines it cites, read from the files below the scanned
 * directories. Doesn't read or require deterministic-findings.json. Prints nothing; every failure throws an
 * AbortError before anything is written.
 */
export default async function securityRecord(
  options: SecurityRecordOptions,
  dependencies: SecurityRecordDependencies = defaultDependencies,
): Promise<SecurityRecordResult> {
  const {selection} = options
  const commands = resolveAppSecurityCommands(selection, options.path)
  const input = await readInputDocument(commands, dependencies)

  const recorded = recordAgentFindings(input, {
    engineVersion: dependencies.engineVersion(),
    readCitedFile: createCitedFileReader(selection.appDirectory, citedFileDirectories(selection)),
  })
  if (!recorded.ok) abortRejectedDocument(recorded.errors, commands)

  // The excerpts are context that `record` adds, so they never make it refuse a document: it drops them instead.
  const document =
    encodedArtifactSize(recorded.document) > MAX_ARTIFACT_FILE_SIZE_BYTES
      ? withoutCodeExcerpts(recorded.document)
      : recorded.document

  // The stored document adds check snapshots and indentation, so an input under the limit can still be stored
  // over it. `review` can't read a file that large, so refuse to replace the existing one with it.
  const storedSize = encodedArtifactSize(document)
  if (storedSize > MAX_ARTIFACT_FILE_SIZE_BYTES) {
    abortRejectedDocument(
      [`The recorded findings would be stored as ${storedSize} bytes; the limit is 5 MB. Shorten or remove findings.`],
      commands,
    )
  }

  const suppressions = await planAgentSuppressions(selection, document)
  let path: string | undefined
  const writeFindings = async () => {
    path = await dependencies.writeAgentFindings(selection.appDirectory, resultsKey(selection), document)
  }
  let saved: SavedSuppression[] = []
  try {
    if (suppressions && suppressions.changes.length > 0) {
      saved = (
        await saveAppSecuritySuppressions(
          selection.appDirectory,
          suppressions.changes,
          suppressions.entries,
          writeFindings,
        )
      ).saved
    } else {
      await writeFindings()
    }
  } catch (error) {
    if (path === undefined) throw error
    const partialWrite = new AbortError(
      'Agent findings were recorded, but the suppressions could not be saved.',
      'Review the results and run record again to save the suppressions.',
    )
    partialWrite.cause = error
    partialWrite.code = 'suppressions-save-failed'
    partialWrite.details = {findingsPath: path, suppressionsPath: appSecuritySuppressionsPath(selection.appDirectory)}
    throw partialWrite
  }
  const findings = document.checks.reduce((total, check) => total + check.findings.length, 0)
  await dependencies.recordMetadata({num_security_findings: findings})
  return {
    path: path!,
    checks: document.checks.length,
    findings,
    suppressions: suppressions
      ? {
          path: appSecuritySuppressionsPath(selection.appDirectory),
          saved,
          alreadySaved: suppressions.alreadySaved,
          notSaved: suppressions.notSaved,
        }
      : null,
  }
}

/**
 * Plans an entry of shopify.app-security.json for each finding that the agent suppressed, with the writer and the
 * matching rules of `review --suppress`, against the recorded document. Returns null when no finding is suppressed, and
 * then doesn't read the file. An invalid file aborts before anything is written. A suppression that no entry can name
 * alone is recorded in agent-findings.json as usual, and reported as not saved.
 */
async function planAgentSuppressions(
  selection: AppSecuritySelection,
  document: AgentFindingsDocument,
): Promise<{
  entries: AppSecuritySuppression[]
  changes: SuppressionChange[]
  alreadySaved: number
  notSaved: RecordedSuppressions['notSaved']
} | null> {
  const targets = document.checks.flatMap((check) =>
    check.findings.flatMap((finding, findingIndex) =>
      finding.suppression?.kind === undefined
        ? []
        : [
            {
              checkId: check.id,
              findingIndex,
              finding,
              kind: finding.suppression.kind,
              reason: finding.suppression.justification,
            },
          ],
    ),
  )
  if (targets.length === 0) return null

  const entries = await readAppSecuritySuppressions(selection.appDirectory)
  const results: SuppressionResults = {
    deterministic: null,
    agent: document,
    resultsKey: resultsKey(selection),
    configuration: suppressionConfiguration(selection),
  }
  const plans = targets.map(({kind, reason, ...target}) => ({
    target,
    plan: planSuppression({source: 'agent', ...target}, {kind, reason}, results, entries),
  }))
  return {
    entries,
    changes: plans.flatMap(({plan}) => (plan.status === 'change' ? [plan.change] : [])),
    alreadySaved: plans.filter(({plan}) => plan.status === 'saved').length,
    notSaved: plans.flatMap(({target, plan}) =>
      plan.status === 'refused'
        ? [{checkId: target.checkId, location: target.finding.location, problem: plan.problem}]
        : [],
    ),
  }
}
