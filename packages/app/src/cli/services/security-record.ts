import {encodedArtifactSize, MAX_ARTIFACT_FILE_SIZE_BYTES, writeAgentFindings} from './app-security-artifacts.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {countLabel} from './app-security-format.js'
import {recordAppSecurityMetadata, type AppSecurityMetadata} from './app-security-metadata.js'
import {getEngineVersion, recordAgentFindings, type AgentFindingsDocument} from './app-security-engine/index.js'
import {resultsKey, type AppSecuritySelection} from './app-security-selection.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readStdinString} from '@shopify/cli-kit/node/system'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import type {AppSecurityCommands} from './app-security-commands.js'

const MAX_FINDINGS_DOCUMENT_BYTES = 5_000_000

/** A recorded findings document: where it was written and what it holds. */
interface SecurityRecordResult {
  path: string
  checks: number
  findings: number
}

interface SecurityRecordOptions {
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
  throw new AbortError(
    'The findings document was rejected. Nothing was recorded.',
    null,
    [['Fix every error, then run', {command: recordCommand(commands)}, 'again.']],
    [{title: 'Errors', body: {list: {items: errors}}}],
  )
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
    throw new AbortError('No findings document was piped on stdin.', null, [
      ['Pipe the findings document on stdin:', {command: recordCommand(commands)}],
    ])
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

/**
 * Validates the agent's findings document from stdin and, only if it is fully valid, replaces
 * agent-findings.json. Doesn't read or require deterministic-findings.json. Prints nothing; every failure throws an
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
  })
  if (!recorded.ok) abortRejectedDocument(recorded.errors, commands)

  // The stored document adds check snapshots and indentation, so an input under the limit can still be stored
  // over it. `review` can't read a file that large, so refuse to replace the existing one with it.
  const storedSize = encodedArtifactSize(recorded.document)
  if (storedSize > MAX_ARTIFACT_FILE_SIZE_BYTES) {
    abortRejectedDocument(
      [`The recorded findings would be stored as ${storedSize} bytes; the limit is 5 MB. Shorten or remove findings.`],
      commands,
    )
  }

  const path = await dependencies.writeAgentFindings(selection.appDirectory, resultsKey(selection), recorded.document)
  const findings = recorded.document.checks.reduce((total, check) => total + check.findings.length, 0)
  await dependencies.recordMetadata({num_security_findings: findings})
  return {path, checks: recorded.document.checks.length, findings}
}

/** Presents a recorded document in the terminal. */
export function renderSecurityRecordResult(
  result: SecurityRecordResult,
  selection: AppSecuritySelection,
  path: string,
): void {
  const commands = resolveAppSecurityCommands(selection, path)
  renderSuccess({
    headline: 'Agent findings recorded.',
    body: [
      `Recorded ${countLabel(result.checks, 'check')} and ${countLabel(result.findings, 'finding')} in`,
      {filePath: result.path},
    ],
    nextSteps: [['Run', {command: formatAppSecurityCommand(commands.review)}, 'to see the results.']],
  })
}
