import {ioError, isMissingPathError} from './fs-errors.js'
import {AppDoctorContextError} from './types.js'
import {toPortablePath} from '../results/scope.js'
import {sha256} from '@shopify/cli-kit/node/crypto'
import {dirname, isAbsolutePath, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {lstat} from 'node:fs/promises'
import type {AppDoctorContext} from './types.js'

/**
 * Storage anchor and configuration identity.
 *
 * The identity is derived only from where the configuration sits relative to
 * its anchor, so it survives edits and whole-checkout relocation while staying
 * distinct for sibling apps. Nothing here creates or opens the store directory.
 *
 * Layout: `<anchor>/.shopify/app-doctor/v1/<config32>/`, where `v1` is the
 * only layout version marker and `<config32>` is the configuration identity.
 */

const IDENTITY_PREIMAGE_LABEL = 'app-doctor-configuration'
const IDENTITY_PREIMAGE_VERSION = 1
/** Path components stay short; 128 bits of the digest is ample for distinguishing sibling configurations. */
const IDENTITY_HEX_LENGTH = 32
const STORE_SEGMENTS = ['.shopify', 'app-doctor', 'v1'] as const
const GIT_MARKER = '.git'

export type StorageAnchor = Pick<AppDoctorContext, 'storageAnchor' | 'storageAnchorKind'>

const requireAbsolute = (label: string, path: string) => {
  if (!isAbsolutePath(path)) {
    throw new AppDoctorContextError('INVALID_PATH', `The ${label} must be absolute, got ${path}.`)
  }
}

/**
 * Classify the `.git` entry of one directory: a directory or regular file is a
 * repository marker (worktrees and submodules use files); anything else is
 * unsupported. Marker contents are never read or followed.
 */
async function hasRepositoryMarker(directory: string): Promise<boolean> {
  const markerPath = joinPath(directory, GIT_MARKER)
  let stats
  try {
    stats = await lstat(markerPath)
  } catch (error) {
    if (isMissingPathError(error)) return false
    throw ioError('inspect', markerPath, error)
  }
  if (stats.isDirectory() || stats.isFile()) return true
  throw new AppDoctorContextError(
    'UNSUPPORTED_PATH',
    `${markerPath} must be a directory or a regular file to act as a repository marker.`,
  )
}

/** Walk upward from the canonical app root; the nearest `.git` marker wins, else the app root itself. */
export async function findStorageAnchor(appRoot: string): Promise<StorageAnchor> {
  requireAbsolute('app root', appRoot)
  let current = appRoot
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    if (await hasRepositoryMarker(current)) return {storageAnchor: current, storageAnchorKind: 'repository'}
    const parent = dirname(current)
    if (parent === current) return {storageAnchor: appRoot, storageAnchorKind: 'app'}
    current = parent
  }
}

/**
 * First 32 hex characters of SHA-256 of `JSON.stringify(["app-doctor-configuration", 1, relative])`
 * where `relative` is the anchor-relative configuration path with `/` separators.
 */
export function computeConfigurationIdentity(storageAnchor: string, configurationPath: string): string {
  requireAbsolute('storage anchor', storageAnchor)
  requireAbsolute('configuration path', configurationPath)
  const relative = toPortablePath(relativePath(storageAnchor, configurationPath))
  if (relative.length === 0 || relative === '..' || relative.startsWith('../')) {
    throw new AppDoctorContextError(
      'INVALID_CONFIGURATION_SELECTION',
      `${configurationPath} is outside the storage anchor ${storageAnchor}.`,
    )
  }
  const preimage = JSON.stringify([IDENTITY_PREIMAGE_LABEL, IDENTITY_PREIMAGE_VERSION, relative])
  return sha256(preimage).toString('hex').slice(0, IDENTITY_HEX_LENGTH)
}

/** `<anchor>/.shopify/app-doctor/v1/<config32>`: where this configuration's App Doctor state would live. Computed only; never created here. */
export function resolveStoreDirectory(storageAnchor: string, configurationIdentity: string): string {
  return joinPath(storageAnchor, ...STORE_SEGMENTS, configurationIdentity)
}
