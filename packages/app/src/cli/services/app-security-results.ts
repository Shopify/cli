import {
  appSecurityArtifactPaths,
  readFindingsDocument,
  resultsDirectoryExists,
  type FindingsDocumentFor,
  type ReadArtifactResult,
} from './app-security-artifacts.js'
import {
  formatAppSecurityCommand,
  resolveAppSecurityCommands,
  type AppSecurityCommands,
} from './app-security-commands.js'
import {projectAppSecurityPath} from './app-security/result.js'
import {resultsKey, type AppSecuritySelection} from './app-security-selection.js'
import {missingSuppressionPaths, readAppSecuritySuppressions} from './app-security-suppressions.js'
import {
  combineFindings,
  type AgentFindingsDocument,
  type CombinedCheck,
  type DeterministicFindingsDocument,
  type FindingsSource,
  type SuppressionEntryResult,
} from './app-security-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {basename} from '@shopify/cli-kit/node/path'
import type {AlertCustomSection, InlineToken, TokenItem} from '@shopify/cli-kit/node/ui'

/** The two stored result files, loaded and combined with shopify.app-security.json (§6). `review` presents this. */
export interface AppSecurityResults {
  sources: {
    deterministic: {path: string; document: DeterministicFindingsDocument} | null
    agent: {path: string; document: AgentFindingsDocument} | null
  }
  checks: CombinedCheck[]
  /** One result per entry of shopify.app-security.json, in file order. Empty without the file. */
  suppressions: SuppressionEntryResult[]
}

/** One result file the reader rejected. */
interface InvalidResultsFile {
  source: FindingsSource
  path: string
  errors: string[]
}

interface LoadedSource<TDocument> {
  path: string
  result: ReadArtifactResult<TDocument>
}

/** Aborts unless the selection's results directory exists. The next step is the `check` that creates it. */
export async function requireResultsDirectory(selection: AppSecuritySelection, path: string): Promise<void> {
  const key = resultsKey(selection)
  if (await resultsDirectoryExists(selection.appDirectory, key)) return

  const {scan} = resolveAppSecurityCommands(selection, path)
  const error = new AbortError(
    `No app security check results for ${key} in ${selection.appDirectory}.`,
    `Run \`${formatAppSecurityCommand(scan)}\`.`,
  )
  error.code = 'results-directory-not-found'
  throw error
}

/**
 * Reads both result files in parallel, then shopify.app-security.json, and combines them. A missing file is a valid
 * state: the agent is optional, and without shopify.app-security.json only the agent's own suppressions apply. Invalid
 * results files abort first, with one error that lists each of them and how to fix it. An invalid
 * shopify.app-security.json aborts next, with the error of `readAppSecuritySuppressions`. No source file is read: only
 * whether the files that entries name still exist, for the likely new path of a stale entry.
 */
export async function loadAppSecurityResults(
  selection: AppSecuritySelection,
  path: string,
): Promise<AppSecurityResults> {
  await requireResultsDirectory(selection, path)
  const key = resultsKey(selection)
  const paths = appSecurityArtifactPaths(selection.appDirectory, key)
  const [deterministic, agent] = await Promise.all([
    loadSource(paths.deterministicFindingsPath, 'deterministic'),
    loadSource(paths.agentFindingsPath, 'agent'),
  ])

  const invalidFiles = [invalidFile(deterministic, 'deterministic'), invalidFile(agent, 'agent')].filter(
    (file): file is InvalidResultsFile => file !== undefined,
  )
  if (invalidFiles.length > 0) abortInvalidResults(invalidFiles, resolveAppSecurityCommands(selection, path))
  const suppressionEntries = await readAppSecuritySuppressions(selection.appDirectory)

  const deterministicSource = presentSource(deterministic)
  const agentSource = presentSource(agent)
  const {checks, suppressions} = combineFindings({
    deterministic: deterministicSource?.document ?? null,
    agent: agentSource?.document ?? null,
    suppressions: {
      entries: suppressionEntries,
      missingPaths: await missingSuppressionPaths(selection.appDirectory, suppressionEntries),
    },
  })
  return {sources: {deterministic: deterministicSource, agent: agentSource}, checks, suppressions}
}

async function loadSource<TSource extends FindingsSource>(
  path: string,
  source: TSource,
): Promise<LoadedSource<FindingsDocumentFor<TSource>>> {
  return {path, result: await readFindingsDocument(path, source)}
}

function invalidFile(loaded: LoadedSource<unknown>, source: FindingsSource): InvalidResultsFile | undefined {
  if (loaded.result.status !== 'invalid') return undefined
  return {source, path: loaded.path, errors: loaded.result.errors}
}

function presentSource<TDocument>(loaded: LoadedSource<TDocument>): {path: string; document: TDocument} | null {
  if (loaded.result.status !== 'ok') return null
  return {path: loaded.path, document: loaded.result.value}
}

/**
 * Aborts with one error for every invalid file: a next step per file with the command that regenerates it, `clean` as
 * the way to start over, and a section per file listing the reader's messages under the file's path. `details.files`
 * repeats each file's absolute path and messages for JSON output.
 */
function abortInvalidResults(invalidFiles: InvalidResultsFile[], commands: AppSecurityCommands): never {
  const message =
    invalidFiles.length === 1
      ? 'The app security check results could not be loaded because a results file is invalid.'
      : 'The app security check results could not be loaded because both results files are invalid.'
  const nextSteps: TokenItem<InlineToken>[] = [
    ...invalidFiles.map((file) => regenerateResultsFileStep(file.source, commands, `${basename(file.path)}.`)),
    ['Or run', {command: formatAppSecurityCommand(commands.clean)}, 'to delete both results files and start over.'],
  ]
  const error = new AbortError(message, null, nextSteps, invalidFiles.map(invalidFileSection))
  error.code = 'results-file-invalid'
  error.details = {files: invalidFiles.map(({path, errors}) => ({path: projectAppSecurityPath(path), errors}))}
  throw error
}

/**
 * The next step that regenerates one result file: `check` rewrites deterministic-findings.json, and only the
 * coding agent rewrites agent-findings.json. `tail` completes the sentence after "regenerate".
 */
function regenerateResultsFileStep(
  source: FindingsSource,
  commands: AppSecurityCommands,
  tail: string,
): TokenItem<InlineToken> {
  if (source === 'deterministic') {
    return ['Run', {command: formatAppSecurityCommand(commands.scan)}, `to regenerate ${tail}`]
  }
  return [
    'Have your coding agent run',
    {command: formatAppSecurityCommand(commands.record)},
    `again to regenerate ${tail}`,
  ]
}

function invalidFileSection(file: InvalidResultsFile): AlertCustomSection {
  return {title: file.path, body: {list: {items: file.errors}}}
}
