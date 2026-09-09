import {validateTrace, type TraceV2} from './app-doctor-engine/index.js'
import {fileExists, fileSize, readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import {randomBytes} from 'node:crypto'
import {lstat, mkdir, realpath, rename, unlink, writeFile} from 'node:fs/promises'
import type {AppDoctorExecution} from './app-doctor-api.js'

const MAX_TRACE_FILE_SIZE_BYTES = 5_000_000

export interface AppDoctorArtifactPaths {
  artifactDirectory: string
  tracePath: string
  reviewPath?: string
}

export interface ResolvedAppDoctorArtifactPaths extends Required<AppDoctorArtifactPaths> {
  submissionPath: string
}

export type ReadTraceResult =
  | {status: 'ok'; trace: TraceV2}
  | {status: 'missing'}
  | {status: 'invalid'; errors: string[]}

export function appDoctorArtifactPaths(appRoot: string): ResolvedAppDoctorArtifactPaths {
  const artifactDirectory = joinPath(appRoot, '.shopify', 'app-doctor')
  return {
    artifactDirectory,
    reviewPath: joinPath(artifactDirectory, 'review.json'),
    submissionPath: joinPath(artifactDirectory, 'submission.json'),
    tracePath: joinPath(artifactDirectory, 'trace.json'),
  }
}

export async function writeAppDoctorArtifacts(execution: AppDoctorExecution): Promise<AppDoctorArtifactPaths> {
  const paths = appDoctorArtifactPaths(execution.appRoot)
  await ensureArtifactDirectory(execution.appRoot, paths.artifactDirectory)
  await writeAtomicArtifact(paths.tracePath, `${JSON.stringify(execution.trace, null, 2)}\n`)
  if (execution.operation !== 'scan') {
    return {artifactDirectory: paths.artifactDirectory, tracePath: paths.tracePath}
  }

  await writeAtomicArtifact(paths.reviewPath, `${JSON.stringify(execution.reviewPack, null, 2)}\n`)
  return {
    artifactDirectory: paths.artifactDirectory,
    reviewPath: paths.reviewPath,
    tracePath: paths.tracePath,
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
  for (const component of ['.shopify', 'app-doctor']) {
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
    `Refusing to write App Doctor artifacts through a symbolic link or outside the app: ${path}`,
    'Remove or replace the unsafe App Doctor artifact path, then run the command again.',
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

  // Keep validation errors structured. Do not replace this with assertCompatibleTrace,
  // which joins them into one exception string.
  const validation = validateTrace(parsed)
  if (!validation.valid) return {status: 'invalid', errors: validation.errors}

  return {status: 'ok', trace: parsed as TraceV2}
}

export async function writeSubmission(appRoot: string, bytes: Buffer): Promise<void> {
  const paths = appDoctorArtifactPaths(appRoot)
  await ensureArtifactDirectory(appRoot, paths.artifactDirectory)
  await writeAtomicArtifact(paths.submissionPath, bytes)
}
