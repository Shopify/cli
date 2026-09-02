import {mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {randomBytes} from 'node:crypto'
import {lstat, rename, unlink, writeFile} from 'node:fs/promises'
import type {AppDoctorExecution} from './app-doctor-api.js'

export interface AppDoctorArtifactPaths {
  artifactDirectory: string
  tracePath: string
  reviewPath?: string
}

export function appDoctorArtifactPaths(appRoot: string): Required<AppDoctorArtifactPaths> {
  const artifactDirectory = joinPath(appRoot, '.shopify', 'app-doctor')
  return {
    artifactDirectory,
    reviewPath: joinPath(artifactDirectory, 'review.json'),
    tracePath: joinPath(artifactDirectory, 'trace.json'),
  }
}

export async function writeAppDoctorArtifacts(execution: AppDoctorExecution): Promise<AppDoctorArtifactPaths> {
  const paths = appDoctorArtifactPaths(execution.appRoot)
  await mkdir(paths.artifactDirectory)
  await writeAtomicArtifact(paths.tracePath, `${JSON.stringify(execution.trace, null, 2)}\n`)
  if (execution.operation !== 'scan') {
    return {artifactDirectory: paths.artifactDirectory, tracePath: paths.tracePath}
  }

  await writeAtomicArtifact(paths.reviewPath, `${JSON.stringify(execution.reviewPack, null, 2)}\n`)
  return paths
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
    if (stats.isSymbolicLink()) {
      throw new Error(`Refusing to write App Doctor artifact through a symbolic link: ${path}`)
    }
    // Missing paths are writable; any other lstat failure is unexpected.
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
}
