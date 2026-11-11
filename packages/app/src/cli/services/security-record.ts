import {
  appSecurityArtifactPaths,
  appSecuritySuppressionsPath,
  encodedArtifactSize,
  MAX_ARTIFACT_FILE_SIZE_BYTES,
  readFindingsDocument,
  writeAgentFindings,
} from './app-security-artifacts.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {recordAppSecurityMetadata, type AppSecurityMetadata} from './app-security-metadata.js'
import {
  createCitedFileReader,
  getEngineVersion,
  listGatheredPaths,
  recordAgentFindings,
  withoutCodeExcerpts,
  type AgentFindingsDocument,
  type AppSecurityScope,
  type SourceTextReader,
  type StoredFinding,
} from './app-security-engine/index.js'
import {mergeScanDirectories, resultsKey, type AppSecuritySelection} from './app-security-selection.js'
import {
  planSuppression,
  readAppSecuritySuppressions,
  saveAppSecuritySuppressions,
  type AppSecuritySuppression,
  type SavedSuppression,
  type SuppressionChange,
  type SuppressionResults,
} from './app-security-suppressions.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, fileRealPath, isDirectory} from '@shopify/cli-kit/node/fs'
import {resolvePath} from '@shopify/cli-kit/node/path'
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
  /** True when the document was written without code excerpts, which would have made it too large. */
  codeExcerptsOmitted?: boolean
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

/**
 * The `--include-dir` directories of the `check` run that the document describes, as real paths: those that its
 * deterministic-findings.json records, when the `include_dirs` of its scope are the document's. `check` wrote that file,
 * so the document can't widen what's read. None when there's no such file, and a directory that's gone is left out.
 */
async function checkIncludeDirectories(selection: AppSecuritySelection, scope: AppSecurityScope): Promise<string[]> {
  const {deterministicFindingsPath} = appSecurityArtifactPaths(selection.appDirectory, resultsKey(selection))
  const deterministic = await readFindingsDocument(deterministicFindingsPath, 'deterministic')
  if (deterministic.status !== 'ok') return []
  const {scope: checkScope, scan_directories: scanDirectories} = deterministic.value.coverage
  const sameIncludeDirs =
    checkScope.include_dirs.length === scope.include_dirs.length &&
    checkScope.include_dirs.every((includeDir, index) => includeDir === scope.include_dirs[index])
  if (!sameIncludeDirs) return []

  const directories: string[] = []
  for (const {directory, origin} of scanDirectories) {
    if (origin !== 'include_dir') continue
    const path = resolvePath(selection.appDirectory, directory)
    // eslint-disable-next-line no-await-in-loop
    if ((await fileExists(path)) && (await isDirectory(path))) directories.push(await fileRealPath(path))
  }
  return directories
}

/**
 * Reads the files that findings cite, for their excerpts, when `check` would gather them with the document's scope:
 * below the app directory, the check run's include directories, and the extension and web directories outside the app
 * directory, with its `excludes` and `no_git_ignore`.
 */
async function createRecordFileReader(
  selection: AppSecuritySelection,
  scope: AppSecurityScope,
): Promise<SourceTextReader> {
  const appConfigDirectories = selection.kind === 'config' ? (selection.appConfigDirectories ?? []) : []
  const merged = mergeScanDirectories(
    selection.appDirectory,
    await checkIncludeDirectories(selection, scope),
    appConfigDirectories,
  )
  const scanDirectories = merged.scanDirectories.map(({directory}) => directory)
  const {paths} = await listGatheredPaths(
    {
      appDirectory: selection.appDirectory,
      scanDirectories,
      requestedScanDirectories: merged.requestedScanDirectories,
      appConfigFilePath: selection.kind === 'config' ? selection.appConfigFilePath : undefined,
    },
    {excludePatterns: scope.excludes, noGitIgnore: scope.no_git_ignore},
  )
  return createCitedFileReader(selection.appDirectory, scanDirectories, new Set(paths))
}

/**
 * Validates the agent's findings document from stdin and, only if it is fully valid, replaces
 * agent-findings.json. Each finding gets the redacted lines it cites, read from the files that `check` would gather
 * with the document's scope. Reads deterministic-findings.json only for the include directories, and doesn't require
 * it. Prints nothing; every failure throws an AbortError before anything is written.
 */
export default async function securityRecord(
  options: SecurityRecordOptions,
  dependencies: SecurityRecordDependencies = defaultDependencies,
): Promise<SecurityRecordResult> {
  const {selection} = options
  const commands = resolveAppSecurityCommands(selection, options.path)
  const input = await readInputDocument(commands, dependencies)

  const engineVersion = dependencies.engineVersion()
  // Validated before anything is gathered, so a rejected document fails fast, and its scope chooses the files to read.
  const validated = recordAgentFindings(input, {engineVersion})
  if (!validated.ok) abortRejectedDocument(validated.errors, commands)
  const recorded = recordAgentFindings(input, {
    engineVersion,
    readCitedFile: await createRecordFileReader(selection, validated.document.scope),
  })
  if (!recorded.ok) abortRejectedDocument(recorded.errors, commands)

  // The excerpts are context that `record` adds, so they never make it refuse a document: it drops them instead.
  const codeExcerptsOmitted = encodedArtifactSize(recorded.document) > MAX_ARTIFACT_FILE_SIZE_BYTES
  const document = codeExcerptsOmitted ? withoutCodeExcerpts(recorded.document) : recorded.document

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
    ...(codeExcerptsOmitted ? {codeExcerptsOmitted} : {}),
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
