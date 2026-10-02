import {
  translateFindingsDocument,
  type AgentChecks,
  type AgentFindingsDocument,
  type DeterministicFindingsDocument,
  type FindingsDocument,
  type FindingsSource,
} from './app-security-engine/index.js'
import {fileExists, fileSize, readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {getOrCreateHiddenShopifyFolder} from '@shopify/cli-kit/node/hidden-folder'
import {joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import {randomBytes} from 'node:crypto'
import {lstat, mkdir, readdir, realpath, rename, rm, unlink, writeFile} from 'node:fs/promises'
import type {Stats} from 'node:fs'

/** Readers reject an artifact larger than this, so writers check `encodedArtifactSize` against it first. */
export const MAX_ARTIFACT_FILE_SIZE_BYTES = 5_000_000

const APP_SECURITY_DIRECTORY_COMPONENTS = ['.shopify', 'app-security']

export interface AppSecurityArtifactPaths {
  /** `<app directory>/.shopify/app-security/<results key>`. */
  resultsDirectory: string
  deterministicFindingsPath: string
  agentChecksPath: string
  agentFindingsPath: string
}

/** An invalid artifact carries every problem the reader found, without the file's path: callers show that. */
export type ReadArtifactResult<T> =
  | {status: 'ok'; value: T}
  | {status: 'missing'}
  | {status: 'invalid'; errors: string[]}

/** The directory that holds one results directory per results key. */
export function appSecurityDirectory(appDirectory: string): string {
  return joinPath(appDirectory, ...APP_SECURITY_DIRECTORY_COMPONENTS)
}

export function appSecurityArtifactPaths(appDirectory: string, resultsKey: string): AppSecurityArtifactPaths {
  assertDirectoryName(resultsKey)
  const resultsDirectory = joinPath(appDirectory, ...APP_SECURITY_DIRECTORY_COMPONENTS, resultsKey)
  return {
    resultsDirectory,
    deterministicFindingsPath: joinPath(resultsDirectory, 'deterministic-findings.json'),
    agentChecksPath: joinPath(resultsDirectory, 'agent-checks.json'),
    agentFindingsPath: joinPath(resultsDirectory, 'agent-findings.json'),
  }
}

/** A `--client-id` becomes a results key, so it must not be able to name `..` or a nested path. */
function assertDirectoryName(resultsKey: string): void {
  if (resultsKey === '' || resultsKey === '.' || resultsKey === '..' || /[\\/]/.test(resultsKey)) {
    throw new AbortError(
      `The results key "${resultsKey}" can't be used as a directory name.`,
      'Use a client ID without path separators.',
    )
  }
}

export type CheckArtifactPaths = Pick<AppSecurityArtifactPaths, 'deterministicFindingsPath' | 'agentChecksPath'>

/** Writes the two files `check` produces: deterministic-findings.json and agent-checks.json. */
export async function writeCheckArtifacts(
  appDirectory: string,
  resultsKey: string,
  {
    deterministicFindings,
    agentChecks,
  }: {deterministicFindings: DeterministicFindingsDocument; agentChecks: AgentChecks},
): Promise<CheckArtifactPaths> {
  const paths = appSecurityArtifactPaths(appDirectory, resultsKey)
  await ensureResultsDirectory(appDirectory, paths.resultsDirectory)
  await writeAtomicArtifact(paths.deterministicFindingsPath, encodeArtifact(deterministicFindings))
  await writeAtomicArtifact(paths.agentChecksPath, encodeArtifact(agentChecks))
  return {deterministicFindingsPath: paths.deterministicFindingsPath, agentChecksPath: paths.agentChecksPath}
}

export async function writeAgentFindings(
  appDirectory: string,
  resultsKey: string,
  document: AgentFindingsDocument,
): Promise<string> {
  const paths = appSecurityArtifactPaths(appDirectory, resultsKey)
  await ensureResultsDirectory(appDirectory, paths.resultsDirectory)
  await writeAtomicArtifact(paths.agentFindingsPath, encodeArtifact(document))
  return paths.agentFindingsPath
}

/** Whether the results directory for the key exists. */
export async function resultsDirectoryExists(appDirectory: string, resultsKey: string): Promise<boolean> {
  const {resultsDirectory} = appSecurityArtifactPaths(appDirectory, resultsKey)
  return existingArtifactDirectory(appDirectory, resultsDirectory)
}

/** Removes the results directory for the key and returns its path, or an empty list when it doesn't exist. */
export async function cleanResultsDirectory(appDirectory: string, resultsKey: string): Promise<string[]> {
  const {resultsDirectory} = appSecurityArtifactPaths(appDirectory, resultsKey)
  if (!(await existingArtifactDirectory(appDirectory, resultsDirectory))) return []
  await removeResultsDirectory(resultsDirectory)
  return [resultsDirectory]
}

/**
 * Removes every results directory under `<app directory>/.shopify/app-security/` and returns their paths.
 * Files that sit directly in it are left alone. Nothing is removed if any entry is a symbolic link.
 */
export async function cleanAllResultsDirectories(appDirectory: string): Promise<string[]> {
  const directory = appSecurityDirectory(appDirectory)
  if (!(await existingArtifactDirectory(appDirectory, directory))) return []

  const paths = (await readdir(directory)).map((entry) => joinPath(directory, entry))
  const entries = await Promise.all(paths.map(async (path) => ({path, stats: await lstat(path)})))
  entries.filter(({stats}) => stats.isSymbolicLink()).forEach(({path}) => refuseArtifactPath(path))
  const resultsDirectories = entries.filter(({stats}) => stats.isDirectory()).map(({path}) => path)

  await Promise.all(resultsDirectories.map(removeResultsDirectory))
  return resultsDirectories
}

/** The findings document type for one source: DeterministicFindingsDocument or AgentFindingsDocument. */
export type FindingsDocumentFor<TSource extends FindingsSource> = Extract<FindingsDocument, {source: TSource}>

/**
 * Reads and translates a stored findings document. `expectedSource` is the source the file at `path` must
 * hold, so a document copied into the wrong file is reported as invalid instead of being displayed as the
 * other source's results. The result is typed for that source, so callers never re-narrow on `source`.
 */
export async function readFindingsDocument<TSource extends FindingsSource>(
  path: string,
  expectedSource: TSource,
): Promise<ReadArtifactResult<FindingsDocumentFor<TSource>>> {
  const result = await readJsonArtifact(path)
  if (result.status !== 'ok') return result

  const translated = translateFindingsDocument(result.value)
  if (!translated.ok) return {status: 'invalid', errors: translated.errors}
  if (!hasSource(translated.document, expectedSource)) {
    return {
      status: 'invalid',
      errors: [`source is "${translated.document.source}", but this file must hold "${expectedSource}" findings.`],
    }
  }
  return {status: 'ok', value: translated.document}
}

function hasSource<TSource extends FindingsSource>(
  document: FindingsDocument,
  source: TSource,
): document is FindingsDocumentFor<TSource> {
  return document.source === source
}

async function readJsonArtifact(path: string): Promise<ReadArtifactResult<unknown>> {
  if (!(await fileExists(path))) return {status: 'missing'}

  let content: string
  try {
    if ((await fileSize(path)) > MAX_ARTIFACT_FILE_SIZE_BYTES) {
      return {status: 'invalid', errors: ['The file is larger than 5 MB.']}
    }
    content = await readFile(path)
    // Filesystem failures are returned for command-layer rendering.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {status: 'invalid', errors: [`Could not read the file: ${errorMessage(error)}`]}
  }

  try {
    return {status: 'ok', value: JSON.parse(content)}
    // JSON is an untrusted artifact boundary.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {status: 'invalid', errors: [`Could not parse JSON: ${errorMessage(error)}`]}
  }
}

/** The size in bytes of `value` once it's written as an artifact. */
export function encodedArtifactSize(value: unknown): number {
  return Buffer.byteLength(encodeArtifact(value), 'utf8')
}

function encodeArtifact(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/**
 * Whether the directory exists. Refuses a directory reached through a link or outside the app directory,
 * so removing results can never delete files elsewhere.
 */
async function existingArtifactDirectory(appDirectory: string, artifactDirectory: string): Promise<boolean> {
  const resolvedRoot = resolvePath(appDirectory)
  const resolvedDirectory = resolvePath(artifactDirectory)
  assertWithinRoot(resolvedRoot, resolvedDirectory)
  const rootStats = await lstat(resolvedRoot)
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) refuseArtifactPath(resolvedDirectory)

  let currentPath = resolvedRoot
  for (const component of relativePath(resolvedRoot, resolvedDirectory).split('/')) {
    currentPath = joinPath(currentPath, component)
    // Each component must be checked in order so a parent link can't redirect the deletions.
    // eslint-disable-next-line no-await-in-loop
    const stats = await lstatIfExists(currentPath)
    if (!stats) return false
    if (stats.isSymbolicLink() || !stats.isDirectory()) refuseArtifactPath(currentPath)
  }

  assertWithinRoot(await realpath(resolvedRoot), await realpath(resolvedDirectory))
  return true
}

async function removeResultsDirectory(path: string): Promise<void> {
  try {
    // A symbolic link inside the directory is removed itself; the recursive removal never follows it.
    await rm(path, {recursive: true, force: true})
  } catch (error) {
    throw new AbortError(`Could not remove the App Security results at ${path}.`, errorMessage(error))
  }
}

async function lstatIfExists(path: string): Promise<Stats | undefined> {
  try {
    return await lstat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

async function ensureResultsDirectory(appDirectory: string, resultsDirectory: string): Promise<void> {
  const resolvedRoot = resolvePath(appDirectory)
  const resolvedDirectory = resolvePath(resultsDirectory)
  assertWithinRoot(resolvedRoot, resolvedDirectory)

  const rootStats = await lstat(resolvedRoot)
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    refuseArtifactPath(resolvedDirectory)
  }

  let currentPath = resolvedRoot
  for (const component of relativePath(resolvedRoot, resolvedDirectory).split('/')) {
    currentPath = joinPath(currentPath, component)
    // Directory components must be checked and created in order to prevent a parent link from redirecting writes.
    // eslint-disable-next-line no-await-in-loop
    await ensureDirectoryComponent(currentPath)
  }

  const realRoot = await realpath(resolvedRoot)
  const realDirectory = await realpath(resolvedDirectory)
  assertWithinRoot(realRoot, realDirectory)

  // Adds `.shopify/.gitignore`, which keeps the results out of version control.
  await getOrCreateHiddenShopifyFolder(appDirectory)
}

async function ensureDirectoryComponent(path: string): Promise<void> {
  try {
    const stats = await lstat(path)
    if (stats.isSymbolicLink() || !stats.isDirectory()) refuseArtifactPath(path)
    return
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  await mkdir(path, {mode: 0o700})
  const stats = await lstat(path)
  if (stats.isSymbolicLink() || !stats.isDirectory()) refuseArtifactPath(path)
}

function assertWithinRoot(root: string, candidate: string): void {
  const relative = relativePath(root, candidate)
  if (!relative || relative.startsWith('..') || relative.startsWith('/')) refuseArtifactPath(candidate)
}

function refuseArtifactPath(path: string): never {
  throw new AbortError(
    `Refusing to write App Security artifacts through a symbolic link or outside the app: ${path}`,
    'Remove or replace the unsafe App Security artifact path, then run the command again.',
  )
}

async function writeAtomicArtifact(path: string, contents: string | Buffer): Promise<void> {
  await assertNotSymbolicLink(path)
  const temporaryPath = `${path}.${randomBytes(8).toString('hex')}.tmp`
  await assertNotSymbolicLink(temporaryPath)
  try {
    await writeFile(temporaryPath, contents, {encoding: 'utf8', mode: 0o600})
    await assertNotSymbolicLink(path)
    await rename(temporaryPath, path)
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

async function assertNotSymbolicLink(path: string): Promise<void> {
  try {
    const stats = await lstat(path)
    if (stats.isSymbolicLink()) refuseArtifactPath(path)
    // Missing paths are writable; any other lstat failure is unexpected.
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
