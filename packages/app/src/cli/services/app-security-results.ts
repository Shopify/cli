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
import {resultsKey, type AppSecuritySelection} from './app-security-selection.js'
import {
  combineFindings,
  type AgentFindingsDocument,
  type CombinedCheck,
  type DeterministicFindingsDocument,
  type FindingsSource,
} from './app-security-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {basename} from '@shopify/cli-kit/node/path'
import type {AlertCustomSection, InlineToken, TokenItem} from '@shopify/cli-kit/node/ui'

/** The two stored result files, loaded and combined (§6). `review` presents this. */
export interface AppSecurityResults {
  sources: {
    deterministic: {path: string; document: DeterministicFindingsDocument} | null
    agent: {path: string; document: AgentFindingsDocument} | null
  }
  checks: CombinedCheck[]
}

/** One result file the reader rejected. Exposed as `error.details.invalidFiles` in JSON mode. */
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
  throw new AbortError(
    `No App Security results for ${key} in ${selection.appDirectory}.`,
    `Run \`${formatAppSecurityCommand(scan)}\`.`,
  )
}

/**
 * Reads both result files in parallel and combines them. A missing file is a valid state: the agent is
 * optional. An invalid file aborts with one error that lists every invalid file and how to fix it.
 */
export async function loadAppSecurityResults(
  selection: AppSecuritySelection,
  path: string,
): Promise<AppSecurityResults> {
  await requireResultsDirectory(selection, path)
  const paths = appSecurityArtifactPaths(selection.appDirectory, resultsKey(selection))
  const [deterministic, agent] = await Promise.all([
    loadSource(paths.deterministicFindingsPath, 'deterministic'),
    loadSource(paths.agentFindingsPath, 'agent'),
  ])

  const invalidFiles = [invalidFile(deterministic, 'deterministic'), invalidFile(agent, 'agent')].filter(
    (file): file is InvalidResultsFile => file !== undefined,
  )
  if (invalidFiles.length > 0) throw invalidResultsError(invalidFiles, resolveAppSecurityCommands(selection, path))

  const deterministicSource = presentSource(deterministic)
  const agentSource = presentSource(agent)
  return {
    sources: {deterministic: deterministicSource, agent: agentSource},
    checks: combineFindings({
      deterministic: deterministicSource?.document ?? null,
      agent: agentSource?.document ?? null,
    }),
  }
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
 * One error for every invalid file: a next step per file with the command that regenerates it, `clean` as
 * the way to start over, and a section per file listing the reader's messages under the file's path.
 */
function invalidResultsError(invalidFiles: InvalidResultsFile[], commands: AppSecurityCommands): AbortError {
  const message =
    invalidFiles.length === 1
      ? 'The App Security results could not be loaded because a results file is invalid.'
      : 'The App Security results could not be loaded because both results files are invalid.'
  const nextSteps: TokenItem<InlineToken>[] = [
    ...invalidFiles.map((file) => regenerateResultsFileStep(file.source, commands, `${basename(file.path)}.`)),
    ['Or run', {command: formatAppSecurityCommand(commands.clean)}, 'to delete both results files and start over.'],
  ]
  const error = new AbortError(message, null, nextSteps, invalidFiles.map(invalidFileSection))
  error.details = {invalidFiles}
  return error
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
