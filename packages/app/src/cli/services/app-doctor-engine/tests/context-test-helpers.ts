import {fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {createHash} from 'node:crypto'
import {symlink} from 'node:fs/promises'

/**
 * Run `callback` inside a fresh temporary directory whose path is already
 * canonical (macOS places temp dirs behind a `/var -> /private/var` symlink).
 */
export async function inCanonicalTemporaryDirectory(callback: (directory: string) => Promise<void>): Promise<void> {
  await inTemporaryDirectory(async (temporaryDirectory) => {
    await callback(normalizePath(await fileRealPath(temporaryDirectory)))
  })
}

/** Write a file (creating parent directories) and return its path. */
export async function writeFixtureFile(directory: string, relativeFile: string, content = ''): Promise<string> {
  const path = joinPath(directory, relativeFile)
  await mkdir(dirname(path))
  await writeFile(path, content)
  return path
}

/** Create a directory and return its path. */
export async function makeFixtureDirectory(directory: string, relativeDirectory: string): Promise<string> {
  const path = joinPath(directory, relativeDirectory)
  await mkdir(path)
  return path
}

/** Create a symlink at `linkPath` pointing to `target`, without requiring `target` to exist. */
export async function createFixtureSymlink(target: string, linkPath: string): Promise<void> {
  await mkdir(dirname(linkPath))
  await symlink(target, linkPath)
}

export const linkedConfiguration = (clientId: string) => `client_id = "${clientId}"\nname = "Fixture"\n`

/**
 * Recompute a configuration identity without going through the engine, so
 * tests pin the identity scheme (label, version, preimage encoding, truncation).
 */
export const independentIdentity = (relative: string) =>
  createHash('sha256')
    .update(JSON.stringify(['app-doctor-configuration', 1, relative]), 'utf8')
    .digest('hex')
    .slice(0, 32)
