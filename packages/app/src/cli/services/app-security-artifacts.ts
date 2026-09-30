import {
  parseDeterministicFindings,
  type AgentFindingsArtifact,
  type DeterministicFindingsDocument,
} from './app-security-engine/index.js'
import {fileExists, fileSize, readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import {randomBytes} from 'node:crypto'
import {lstat, mkdir, realpath, rename, unlink, writeFile} from 'node:fs/promises'
import type {AppSecurityExecution} from './app-security-api.js'

const MAX_ARTIFACT_FILE_SIZE_BYTES = 5_000_000

export interface AppSecurityArtifactPaths {
  artifactDirectory: string
  deterministicFindingsPath: string
  agentChecksPath: string
}

export interface ResolvedAppSecurityArtifactPaths extends Required<AppSecurityArtifactPaths> {
  agentFindingsPath: string
  submissionPath: string
}

export type ReadArtifactResult<T> =
  | {status: 'ok'; value: T}
  | {status: 'missing'}
  | {status: 'invalid'; message: string}

export function appSecurityArtifactPaths(appRoot: string): ResolvedAppSecurityArtifactPaths {
  const artifactDirectory = joinPath(appRoot, '.shopify', 'app-security')
  return {
    artifactDirectory,
    agentChecksPath: joinPath(artifactDirectory, 'agent-checks.json'),
    agentFindingsPath: joinPath(artifactDirectory, 'agent-findings.json'),
    submissionPath: joinPath(artifactDirectory, 'submission.json'),
    deterministicFindingsPath: joinPath(artifactDirectory, 'deterministic-findings.json'),
  }
}

export interface WriteAppSecurityArtifactsOptions {
  clean?: boolean
}

export async function writeAppSecurityArtifacts(
  execution: AppSecurityExecution,
  options: WriteAppSecurityArtifactsOptions = {},
): Promise<AppSecurityArtifactPaths> {
  const paths = appSecurityArtifactPaths(execution.appRoot)
  await ensureArtifactDirectory(execution.appRoot, paths.artifactDirectory)
  await writeAtomicArtifact(paths.deterministicFindingsPath, `${JSON.stringify(execution.artifact, null, 2)}\n`)
  await writeAtomicArtifact(paths.agentChecksPath, `${JSON.stringify(execution.agentChecks, null, 2)}\n`)
  if (options.clean) {
    await removeStaleArtifact(paths.agentFindingsPath)
    await removeStaleArtifact(paths.submissionPath)
  }
  return {
    artifactDirectory: paths.artifactDirectory,
    agentChecksPath: paths.agentChecksPath,
    deterministicFindingsPath: paths.deterministicFindingsPath,
  }
}

export async function writeAgentFindings(appRoot: string, artifact: AgentFindingsArtifact): Promise<string> {
  const paths = appSecurityArtifactPaths(appRoot)
  await ensureArtifactDirectory(appRoot, paths.artifactDirectory)
  await writeAtomicArtifact(paths.agentFindingsPath, `${JSON.stringify(artifact, null, 2)}\n`)
  return paths.agentFindingsPath
}

async function removeStaleArtifact(path: string): Promise<void> {
  try {
    await unlink(path)
  } catch (error) {
    // Missing stale artifacts are already clean.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw new AbortError(`Could not remove stale App Security artifact at ${path}.`, errorMessage(error))
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

export async function readDeterministicFindings(
  path: string,
): Promise<ReadArtifactResult<DeterministicFindingsDocument>> {
  const result = await readJsonArtifact(path)
  if (result.status !== 'ok') return result

  const parsed = parseDeterministicFindings(result.value)
  if (!parsed.ok) return {status: 'invalid', message: parsed.errors.join('; ')}
  return {status: 'ok', value: parsed.artifact}
}

async function readJsonArtifact(path: string): Promise<ReadArtifactResult<unknown>> {
  if (!(await fileExists(path))) return {status: 'missing'}

  let content: string
  try {
    if ((await fileSize(path)) > MAX_ARTIFACT_FILE_SIZE_BYTES) {
      return {status: 'invalid', message: 'The file is larger than 5 MB.'}
    }
    content = await readFile(path)
    // Filesystem failures are returned for command-layer rendering.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {status: 'invalid', message: `Could not read the file: ${errorMessage(error)}`}
  }

  try {
    return {status: 'ok', value: JSON.parse(content)}
    // JSON is an untrusted artifact boundary.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {status: 'invalid', message: `Could not parse JSON: ${errorMessage(error)}`}
  }
}

export async function writeSubmission(appRoot: string, bytes: Buffer): Promise<void> {
  const paths = appSecurityArtifactPaths(appRoot)
  await ensureArtifactDirectory(appRoot, paths.artifactDirectory)
  await writeAtomicArtifact(paths.submissionPath, bytes)
}
