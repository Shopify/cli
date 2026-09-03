import {AbortError} from '@shopify/cli-kit/node/error'
import {joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import {randomBytes} from 'node:crypto'
import {lstat, mkdir, realpath, rename, unlink, writeFile} from 'node:fs/promises'
import type {AppDoctorExecution} from './app-doctor-api.js'

export interface AppDoctorArtifactPaths {
  artifactDirectory: string
  tracePath: string
  reviewPath?: string
}

function appDoctorArtifactPaths(appRoot: string): Required<AppDoctorArtifactPaths> {
  const artifactDirectory = joinPath(appRoot, '.shopify', 'app-doctor')
  return {
    artifactDirectory,
    reviewPath: joinPath(artifactDirectory, 'review.json'),
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
  return paths
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

async function writeAtomicArtifact(path: string, contents: string): Promise<void> {
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
