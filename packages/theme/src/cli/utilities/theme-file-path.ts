import {fileRealPath} from '@shopify/cli-kit/node/fs'
import {dirname, isSubpath, joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {lstat} from 'node:fs/promises'

export async function fileExistsNoFollow(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return false
    }
    throw error
  }
}

async function closestExistingPath(path: string, root: string): Promise<string> {
  if (path === root || (await fileExistsNoFollow(path))) return path
  return closestExistingPath(dirname(path), root)
}

export function validateListingName(listingName: string): void {
  if (
    !listingName ||
    listingName === '.' ||
    listingName === '..' ||
    /[\\/]/.test(listingName) ||
    /^[a-z]:/i.test(listingName)
  ) {
    throw new AbortError(`Unsafe listing name: ${listingName}`)
  }
}

export async function resolveThemeFilePath(root: string, key: string): Promise<string> {
  const normalizedKey = key.replace(/\\/g, '/')
  if (!key || /^[\\/]/.test(key) || /^[a-z]:/i.test(key) || normalizedKey.split('/').includes('..')) {
    throw new AbortError(`Unsafe theme file key: ${key}`)
  }

  const absoluteRoot = resolvePath(root)
  const candidatePath = joinPath(absoluteRoot, normalizedKey)
  if (relativePath(absoluteRoot, candidatePath) === '' || !isSubpath(absoluteRoot, candidatePath, {native: true})) {
    throw new AbortError(`Unsafe theme file key: ${key}`)
  }

  const existingPath = await closestExistingPath(candidatePath, absoluteRoot)

  try {
    const realRoot = await fileRealPath(absoluteRoot)
    const realExistingPath = await fileRealPath(existingPath)
    if (!isSubpath(realRoot, realExistingPath, {native: true})) {
      throw new AbortError(`Unsafe theme file key: ${key}`)
    }
  } catch {
    throw new AbortError(`Unsafe theme file key: ${key}`)
  }

  return candidatePath
}
