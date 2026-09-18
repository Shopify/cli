/* eslint-disable no-restricted-imports -- flavor-injected projection needs node:path's posix and win32 implementations */
/**
 * Pure path projection and scope identity.
 *
 * Inputs are already filesystem-canonical (realpath'd) absolute paths. Nothing
 * here opens files, consults the working directory, or claims a path exists;
 * the flavor parameter only selects which platform's path grammar to apply so
 * Windows volume behaviour is testable everywhere.
 */
import {AppDoctorScopeError} from './types.js'
import {AppDoctorResultError} from '../results/error.js'
import {formatAppDoctorEvidencePath, isAppDoctorEvidencePath, isAppDoctorReferencePath} from '../results/scope.js'
import {canonicalJson, sha256} from '../trace/index.js'
import path from 'node:path'
import type {AppDoctorPathReference} from '../results/scope.js'

export type ScopePathFlavor = 'posix' | 'win32'
export const nativeFlavor: ScopePathFlavor = process.platform === 'win32' ? 'win32' : 'posix'

const VOLUME_TOKEN_LABEL = 'shopify-app-doctor/volume/v1'
const SCOPE_IDENTITY_LABEL = 'shopify-app-doctor/scope/v1'
const WINDOWS_UNC_NAMESPACE_PREFIX = '\\\\?\\UNC\\'
const WINDOWS_NAMESPACE_PREFIX = '\\\\?\\'

const splitComponents = (value: string, separator: string) => value.split(separator).filter(Boolean)

/** Remove the `\\?\` transport prefix so the path parser sees the real drive or UNC root. */
function stripWindowsNamespacePrefix(value: string): string {
  if (value.startsWith(WINDOWS_UNC_NAMESPACE_PREFIX)) return `\\\\${value.slice(WINDOWS_UNC_NAMESPACE_PREFIX.length)}`
  if (value.startsWith(WINDOWS_NAMESPACE_PREFIX)) return value.slice(WINDOWS_NAMESPACE_PREFIX.length)
  return value
}

/** Drive roots are spelled `C:\`; UNC roots `\\server\share\`. Descendant casing is left to the filesystem. */
function canonicalRoot(root: string, flavor: ScopePathFlavor): string {
  if (flavor !== 'win32') return root
  return root.startsWith('\\\\') ? root.toLowerCase() : root.toUpperCase()
}

/**
 * Canonicalize native transport and root spelling of an already
 * filesystem-canonical absolute path: strip namespace prefixes, fix root
 * casing, normalize separators, and drop trailing separators except on a root.
 */
export function canonicalLocation(value: string, flavor: ScopePathFlavor = nativeFlavor): string {
  const api = path[flavor]
  const input = flavor === 'win32' ? stripWindowsNamespacePrefix(value) : value
  if (!api.isAbsolute(input)) {
    throw new AppDoctorScopeError('INVALID_PATH', `Expected a canonical absolute path, got ${value}.`)
  }
  const normalized = api.normalize(input)
  const root = api.parse(normalized).root
  // `normalize` has already collapsed repeated separators, so this only drops a trailing one.
  const suffix = splitComponents(normalized.slice(root.length), api.sep).join(api.sep)
  return `${canonicalRoot(root, flavor)}${suffix}`
}

/** True when `child` is `parent` or one of its descendants, compared component-wise. */
export function containsPath(parent: string, child: string, flavor: ScopePathFlavor = nativeFlavor): boolean {
  const api = path[flavor]
  const relative = api.relative(canonicalLocation(parent, flavor), canonicalLocation(child, flavor))
  if (relative === '') return true
  return !api.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${api.sep}`)
}

const encodeComponents = (components: ReadonlyArray<string>) =>
  components.length === 0 ? '.' : components.map(encodeURIComponent).join('/')

/**
 * Project a canonical absolute path onto the storage anchor. Paths on another
 * Windows volume (drive or UNC share) have no relative spelling and are keyed
 * by a token derived from the volume root instead.
 */
export function projectAppDoctorPath(
  storageAnchor: string,
  canonicalAbsolutePath: string,
  flavor: ScopePathFlavor = nativeFlavor,
): AppDoctorPathReference {
  const api = path[flavor]
  const anchor = canonicalLocation(storageAnchor, flavor)
  const target = canonicalLocation(canonicalAbsolutePath, flavor)
  const targetRoot = api.parse(target).root
  if (api.parse(anchor).root !== targetRoot) {
    return {
      base: 'external_volume',
      volume_token: sha256(canonicalJson([VOLUME_TOKEN_LABEL, targetRoot])),
      path: encodeComponents(splitComponents(api.relative(targetRoot, target), api.sep)),
    }
  }
  const components = splitComponents(api.relative(anchor, target), api.sep)
  const up = components.findIndex((component) => component !== '..')
  const descendants = up === -1 ? [] : components.slice(up)
  return {base: 'storage_anchor', up: up === -1 ? components.length : up, path: encodeComponents(descendants)}
}

/**
 * Identity of a scope directory. In-anchor directories hash their anchor-relative
 * locator so relocating the whole checkout preserves identity; anything else
 * hashes its canonical absolute spelling. Labels never participate.
 */
export function appDoctorScopeIdentity(
  storageAnchor: string,
  canonicalDirectory: string,
  flavor: ScopePathFlavor = nativeFlavor,
): string {
  const api = path[flavor]
  const anchor = canonicalLocation(storageAnchor, flavor)
  const directory = canonicalLocation(canonicalDirectory, flavor)
  const locator = containsPath(anchor, directory, flavor)
    ? ['anchor_relative', api.relative(anchor, directory).split(api.sep).join('/') || '.']
    : ['canonical_absolute', flavor, directory]
  return sha256(canonicalJson([SCOPE_IDENTITY_LABEL, locator]))
}

/**
 * Evidence path for an already observed file. Projection only: never an opener,
 * never a CWD lookup. Files the evidence contract cannot carry (e.g. a component
 * containing a control character) are reported as `DESCRIPTOR_INVALID` so
 * callers only ever see `AppDoctorScopeError` from this module.
 */
export function projectAppDoctorEvidencePath(
  storageAnchor: string,
  canonicalAbsoluteFile: string,
  flavor: ScopePathFlavor = nativeFlavor,
): string {
  try {
    return formatAppDoctorEvidencePath(projectAppDoctorPath(storageAnchor, canonicalAbsoluteFile, flavor))
  } catch (error) {
    if (!(error instanceof AppDoctorResultError)) throw error
    throw new AppDoctorScopeError('DESCRIPTOR_INVALID', "The file can't be described as an evidence path.")
  }
}

/**
 * Inverse of `projectAppDoctorEvidencePath`: spell an `anchor/<up>/<path>`
 * evidence reference as a local absolute path under `storageAnchor`. Pure
 * projection, so the result is where the file *would* be, not proof it exists.
 *
 * Returns `undefined` rather than throwing for anything without a local
 * spelling: volume-token references (another Windows volume), malformed
 * references, an anchor that is not absolute, or more upward steps than the
 * anchor has components.
 */
export function resolveAppDoctorEvidencePath(
  reference: string,
  storageAnchor: string,
  flavor: ScopePathFlavor = nativeFlavor,
): string | undefined {
  if (!isAppDoctorEvidencePath(reference)) return undefined
  const [base, up, ...encodedComponents] = reference.split('/')
  if (base !== 'anchor') return undefined
  return joinUnderAnchor(Number(up), encodedComponents, storageAnchor, flavor)
}

/**
 * Inverse of `projectAppDoctorPath` for a scope descriptor's directory
 * reference. Pure projection like `resolveAppDoctorEvidencePath`, with the same
 * `undefined` cases; a `.` path names the reference base itself.
 */
export function resolveAppDoctorScopeDirectory(
  reference: AppDoctorPathReference,
  storageAnchor: string,
  flavor: ScopePathFlavor = nativeFlavor,
): string | undefined {
  if (reference.base !== 'storage_anchor') return undefined
  if (!isAppDoctorReferencePath(reference.path, true)) return undefined
  const encodedComponents = reference.path === '.' ? [] : reference.path.split('/')
  return joinUnderAnchor(reference.up, encodedComponents, storageAnchor, flavor)
}

/** Step `upLevels` above the canonical anchor, then descend through the validated encoded components. */
function joinUnderAnchor(
  upLevels: number,
  encodedComponents: ReadonlyArray<string>,
  storageAnchor: string,
  flavor: ScopePathFlavor,
): string | undefined {
  const api = path[flavor]
  let anchor: string
  try {
    anchor = canonicalLocation(storageAnchor, flavor)
  } catch (error) {
    if (error instanceof AppDoctorScopeError) return undefined
    throw error
  }
  const root = api.parse(anchor).root
  const anchorComponents = splitComponents(anchor.slice(root.length), api.sep)
  if (upLevels > anchorComponents.length) return undefined

  // Components were validated as exact `encodeURIComponent` round trips, so decoding cannot throw.
  const components = encodedComponents.map(decodeURIComponent)
  // `%5C` is an opaque character in a reference, but on Windows it can only be a separator, never part of a name.
  if (components.some((component) => component.includes(api.sep))) return undefined
  const baseComponents = anchorComponents.slice(0, anchorComponents.length - upLevels)
  return `${root}${[...baseComponents, ...components].join(api.sep)}`
}
