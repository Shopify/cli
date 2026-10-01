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
import {joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import {randomBytes} from 'node:crypto'
import {lstat, mkdir, realpath, rename, unlink, writeFile} from 'node:fs/promises'
import type {Stats} from 'node:fs'

const MAX_ARTIFACT_FILE_SIZE_BYTES = 5_000_000

export interface AppSecurityArtifactPaths {
  artifactDirectory: string
  deterministicFindingsPath: string
  agentChecksPath: string
  agentFindingsPath: string
  /** Artifacts written by earlier CLI versions. Nothing reads them; `clean` removes them. */
  legacyPaths: string[]
}

/** An invalid artifact carries every problem the reader found, without the file's path: callers show that. */
export type ReadArtifactResult<T> =
  | {status: 'ok'; value: T}
  | {status: 'missing'}
  | {status: 'invalid'; errors: string[]}

export function appSecurityArtifactPaths(appRoot: string): AppSecurityArtifactPaths {
  const artifactDirectory = joinPath(appRoot, '.shopify', 'app-security')
  return {
    artifactDirectory,
    deterministicFindingsPath: joinPath(artifactDirectory, 'deterministic-findings.json'),
    agentChecksPath: joinPath(artifactDirectory, 'agent-checks.json'),
    agentFindingsPath: joinPath(artifactDirectory, 'agent-findings.json'),
    legacyPaths: ['trace.json', 'review.json', 'findings.json'].map((name) => joinPath(artifactDirectory, name)),
  }
}

export type CheckArtifactPaths = Pick<AppSecurityArtifactPaths, 'deterministicFindingsPath' | 'agentChecksPath'>

/** Writes the two files `check` produces: deterministic-findings.json and agent-checks.json. */
export async function writeCheckArtifacts(
  appRoot: string,
  {
    deterministicFindings,
    agentChecks,
  }: {deterministicFindings: DeterministicFindingsDocument; agentChecks: AgentChecks},
): Promise<CheckArtifactPaths> {
  const paths = appSecurityArtifactPaths(appRoot)
  await ensureArtifactDirectory(appRoot, paths.artifactDirectory)
  await writeAtomicArtifact(paths.deterministicFindingsPath, encodeArtifact(deterministicFindings))
  await writeAtomicArtifact(paths.agentChecksPath, encodeArtifact(agentChecks))
  return {deterministicFindingsPath: paths.deterministicFindingsPath, agentChecksPath: paths.agentChecksPath}
}

export async function writeAgentFindings(appRoot: string, document: AgentFindingsDocument): Promise<string> {
  const paths = appSecurityArtifactPaths(appRoot)
  await ensureArtifactDirectory(appRoot, paths.artifactDirectory)
  await writeAtomicArtifact(paths.agentFindingsPath, encodeArtifact(document))
  return paths.agentFindingsPath
}

/**
 * Removes every current and legacy App Security artifact that exists, and returns the removed paths.
 * Other files in the artifact directory are left alone.
 */
export async function cleanAppSecurityArtifacts(appRoot: string): Promise<string[]> {
  const paths = appSecurityArtifactPaths(appRoot)
  if (!(await existingArtifactDirectory(appRoot, paths.artifactDirectory))) return []

  const candidates = [
    paths.deterministicFindingsPath,
    paths.agentChecksPath,
    paths.agentFindingsPath,
    ...paths.legacyPaths,
  ]
  const removed = await Promise.all(candidates.map(removeArtifactFile))
  return candidates.filter((_path, index) => removed[index])
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

function encodeArtifact(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/**
 * Whether the artifact directory exists. Refuses a directory reached through a link or outside the app,
 * so removing artifacts can never delete files elsewhere.
 */
async function existingArtifactDirectory(appRoot: string, artifactDirectory: string): Promise<boolean> {
  const resolvedRoot = resolvePath(appRoot)
  const rootStats = await lstat(resolvedRoot)
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) refuseArtifactPath(resolvePath(artifactDirectory))

  let currentPath = resolvedRoot
  for (const component of ['.shopify', 'app-security']) {
    currentPath = joinPath(currentPath, component)
    // Each component must be checked in order so a parent link can't redirect the deletions.
    // eslint-disable-next-line no-await-in-loop
    const stats = await lstatIfExists(currentPath)
    if (!stats) return false
    if (stats.isSymbolicLink() || !stats.isDirectory()) refuseArtifactPath(currentPath)
  }

  assertWithinRoot(await realpath(resolvedRoot), await realpath(resolvePath(artifactDirectory)))
  return true
}

async function removeArtifactFile(path: string): Promise<boolean> {
  try {
    // unlink removes a symbolic link itself and never follows it to its target.
    await unlink(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw new AbortError(`Could not remove the App Security artifact at ${path}.`, errorMessage(error))
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

async function ensureArtifactDirectory(appRoot: string, artifactDirectory: string): Promise<void> {
  const resolvedRoot = resolvePath(appRoot)
  const resolvedDirectory = resolvePath(artifactDirectory)
  assertWithinRoot(resolvedRoot, resolvedDirectory)

  const rootStats = await lstat(resolvedRoot)
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    refuseArtifactPath(resolvedDirectory)
  }

  let currentPath = resolvedRoot
  for (const component of ['.shopify', 'app-security']) {
    currentPath = joinPath(currentPath, component)
    // Directory components must be checked and created in order to prevent a parent link from redirecting writes.
    // eslint-disable-next-line no-await-in-loop
    await ensureDirectoryComponent(currentPath)
  }

  const realRoot = await realpath(resolvedRoot)
  const realDirectory = await realpath(resolvedDirectory)
  assertWithinRoot(realRoot, realDirectory)
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
