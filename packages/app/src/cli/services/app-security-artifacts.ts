import {parseTrace, type TraceV3} from './app-security-engine/index.js'
import {fileExists, fileSize, readFile} from '@shopify/cli-kit/node/fs'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import lockfile, {type LockOptions} from 'proper-lockfile'
import {randomBytes} from 'node:crypto'
import {lstat, mkdir, realpath, rename, unlink, writeFile} from 'node:fs/promises'
import type {AppSecurityExecution} from './app-security-api.js'

const MAX_TRACE_FILE_SIZE_BYTES = 5_000_000

// A lock whose holder stops refreshing it for this long is treated as abandoned by a crashed process.
const TRACE_LOCK_STALE_MILLISECONDS = 10_000
// Publication holds the lock for milliseconds. The total wait (~17 seconds) outlasts TRACE_LOCK_STALE_MILLISECONDS,
// so a lock left by a crashed process is reclaimed instead of reported as busy.
const TRACE_LOCK_RETRIES: LockOptions['retries'] = {retries: 20, minTimeout: 100, maxTimeout: 1000}

export interface AppSecurityArtifactPaths {
  artifactDirectory: string
  tracePath: string
  reviewPath?: string
}

export interface ResolvedAppSecurityArtifactPaths extends Required<AppSecurityArtifactPaths> {
  findingsPath: string
  submissionPath: string
  traceLockPath: string
}

export type ReadTraceResult =
  | {status: 'ok'; trace: TraceV3}
  | {status: 'missing'}
  | {status: 'invalid'; errors: string[]}

export function appSecurityArtifactPaths(appRoot: string): ResolvedAppSecurityArtifactPaths {
  const artifactDirectory = joinPath(appRoot, '.shopify', 'app-security')
  return {
    artifactDirectory,
    reviewPath: joinPath(artifactDirectory, 'review.json'),
    findingsPath: joinPath(artifactDirectory, 'findings.json'),
    submissionPath: joinPath(artifactDirectory, 'submission.json'),
    tracePath: joinPath(artifactDirectory, 'trace.json'),
    traceLockPath: joinPath(artifactDirectory, 'trace.lock'),
  }
}

/**
 * Identifies the shared artifact state a command started from, so it can refuse to publish over changes made while
 * it was running.
 */
export interface AppSecurityArtifactState {
  // Undefined when there is no trace.
  traceDigest?: string
  findingsExist: boolean
}

export async function readAppSecurityArtifactState(
  paths: ResolvedAppSecurityArtifactPaths,
): Promise<AppSecurityArtifactState> {
  return {
    traceDigest: await traceDigest(paths.tracePath),
    findingsExist: await fileExists(paths.findingsPath),
  }
}

async function traceDigest(path: string): Promise<string | undefined> {
  try {
    return hashString(await readFile(path))
    // Publishing surfaces problems with an unreadable trace path; here it only needs to compare as unchanged.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    return 'unreadable'
  }
}

interface TracePublicationLockOptions {
  retries?: LockOptions['retries']
}

/**
 * Runs `publish` while holding the cross-process trace publication lock for the app.
 *
 * The lock guards the whole read/validate/finalize/publish step so cooperating CLI processes cannot interleave
 * trace updates. Keep scanning, agent work, and prompts outside `publish`; they would hold the lock for too long.
 * Readers don't need the lock because artifacts are replaced atomically.
 */
export async function withTracePublicationLock<T>(
  appRoot: string,
  publish: (paths: ResolvedAppSecurityArtifactPaths) => Promise<T>,
  options: TracePublicationLockOptions = {},
): Promise<T> {
  const paths = appSecurityArtifactPaths(appRoot)
  await ensureArtifactDirectory(appRoot, paths.artifactDirectory)
  await assertNotSymbolicLink(paths.traceLockPath)
  const release = await acquireTraceLock(paths, options.retries ?? TRACE_LOCK_RETRIES)
  let result: T
  try {
    result = await publish(paths)
  } catch (error) {
    // A release failure must not replace the publication failure that explains what went wrong.
    await release().catch((releaseError: unknown) => {
      outputDebug(`Failed to release the App Security trace lock: ${errorMessage(releaseError)}`)
    })
    throw error
  }
  await release()
  return result
}

async function acquireTraceLock(
  paths: ResolvedAppSecurityArtifactPaths,
  retries: LockOptions['retries'],
): Promise<() => Promise<void>> {
  try {
    // The lock lives beside the trace instead of on it, so it works before the first trace exists and survives the
    // atomic rename that replaces the trace.
    return await lockfile.lock(paths.artifactDirectory, {
      lockfilePath: paths.traceLockPath,
      retries,
      stale: TRACE_LOCK_STALE_MILLISECONDS,
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ELOCKED') throw error
    throw new AbortError(
      'Another Shopify CLI command is updating the App Security trace.',
      'Wait for the other command to finish, then run this command again.',
    )
  }
}

export interface WriteAppSecurityArtifactsOptions {
  clean?: boolean
}

/**
 * Writes the artifacts for an execution. Commands must call this inside `withTracePublicationLock` so concurrent
 * publications can't interleave.
 */
export async function writeAppSecurityArtifacts(
  execution: AppSecurityExecution,
  options: WriteAppSecurityArtifactsOptions = {},
): Promise<AppSecurityArtifactPaths> {
  if (options.clean && execution.operation === 'compile') {
    throw new AbortError(
      "Can't clean App Security artifacts while compiling findings.",
      'Run a scan with clean instead, or compile the findings without clean.',
    )
  }

  const paths = appSecurityArtifactPaths(execution.appRoot)
  await ensureArtifactDirectory(execution.appRoot, paths.artifactDirectory)
  await writeAtomicArtifact(paths.tracePath, `${JSON.stringify(execution.trace, null, 2)}\n`)
  if (execution.operation !== 'scan') {
    return {artifactDirectory: paths.artifactDirectory, tracePath: paths.tracePath}
  }

  await writeAtomicArtifact(paths.reviewPath, `${JSON.stringify(execution.reviewPack, null, 2)}\n`)
  if (options.clean) {
    await removeStaleArtifact(paths.findingsPath)
    await removeStaleArtifact(paths.submissionPath)
  }
  return {
    artifactDirectory: paths.artifactDirectory,
    reviewPath: paths.reviewPath,
    tracePath: paths.tracePath,
  }
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

  try {
    await mkdir(path, {mode: 0o700})
  } catch (error) {
    // Another process may create the directory between the check above and mkdir. The lstat below still refuses
    // anything that isn't a real directory.
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
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

export async function readTrace(path: string): Promise<ReadTraceResult> {
  if (!(await fileExists(path))) return {status: 'missing'}

  let content: string
  try {
    if ((await fileSize(path)) > MAX_TRACE_FILE_SIZE_BYTES) {
      return {status: 'invalid', errors: ['The trace file is larger than 5 MB.']}
    }
    content = await readFile(path)
    // Filesystem failures are returned for command-layer rendering.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {status: 'invalid', errors: [`Could not read the trace file: ${errorMessage(error)}`]}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
    // JSON is an untrusted artifact boundary.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {status: 'invalid', errors: [`Could not parse JSON: ${errorMessage(error)}`]}
  }

  const trace = parseTrace(parsed)
  if (!trace.ok) return {status: 'invalid', errors: trace.errors}
  return {status: 'ok', trace: trace.trace}
}

export async function writeSubmission(appRoot: string, bytes: Buffer): Promise<void> {
  const paths = appSecurityArtifactPaths(appRoot)
  await ensureArtifactDirectory(appRoot, paths.artifactDirectory)
  await writeAtomicArtifact(paths.submissionPath, bytes)
}
