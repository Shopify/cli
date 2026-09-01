import {basename, dirname, isAbsolutePath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import {randomBytes} from 'node:crypto'
import type {Stats} from 'node:fs'

export const MAX_REPOSITORY_FILE_SIZE_BYTES = 500_000
export const MAX_FINDINGS_FILE_SIZE_BYTES = 5_000_000

export type SafeReadFailureReason = 'symlink' | 'outside_root' | 'not_regular' | 'too_large' | 'unreadable'

export interface SafeReadSuccess {
  ok: true
  path: string
  content: Buffer
  sizeBytes: number
}

export interface SafeReadFailure {
  ok: false
  path: string
  reason: SafeReadFailureReason
  sizeBytes?: number
  detail?: string
  errorCode?: string
}

export type SafeReadResult = SafeReadSuccess | SafeReadFailure

/** @internal A deterministic seam for filesystem race regression tests. */
interface RepositoryIOTestHooks {
  afterReadOpen?: () => void
  afterTemporaryFileClosed?: (temporaryPath: string) => void
}

function unreadable(path: string, error?: unknown, detail = 'File could not be safely read'): SafeReadFailure {
  const errorCode = (error as NodeJS.ErrnoException | undefined)?.code
  return {
    ok: false,
    path,
    reason: 'unreadable',
    detail,
    ...(errorCode && /^[A-Z0-9_]+$/.test(errorCode) ? {errorCode} : {}),
  }
}

function isContained(root: string, candidate: string): boolean {
  const pathFromRoot = relativePath(root, candidate)
  return (
    pathFromRoot === '' || (!pathFromRoot.startsWith('../') && pathFromRoot !== '..' && !isAbsolutePath(pathFromRoot))
  )
}

export function canonicalAppRoot(appRoot: string): string {
  const canonicalRoot = realpathSync(resolvePath(appRoot))
  if (!lstatSync(canonicalRoot).isDirectory()) throw new Error(`App root is not a directory: ${appRoot}`)
  return canonicalRoot
}

function inspectPathForSymlinks(root: string, candidate: string): SafeReadFailure | undefined {
  const pathFromRoot = relativePath(root, candidate)
  if (!isContained(root, candidate)) return {ok: false, path: candidate, reason: 'outside_root'}
  if (pathFromRoot === '') return undefined

  let current = root
  for (const component of pathFromRoot.replaceAll('\\', '/').split('/')) {
    current = resolvePath(current, component)
    try {
      if (lstatSync(current).isSymbolicLink()) return {ok: false, path: candidate, reason: 'symlink'}
      // Every path-inspection failure is represented as a rejected read.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      return unreadable(candidate, error)
    }
  }
  return undefined
}

function sameFile(before: Stats, after: Stats): boolean {
  return before.dev === after.dev && before.ino === after.ino && before.mode === after.mode
}

function hasFileIdentity(stats: Stats): boolean {
  return Number.isSafeInteger(stats.dev) && Number.isSafeInteger(stats.ino) && stats.ino !== 0
}

function identityFailure(path: string): SafeReadFailure {
  return unreadable(path, undefined, "The platform can't verify file identity")
}

function inspectOpenedPath(path: string, opened: Stats): SafeReadFailure | undefined {
  try {
    const current = lstatSync(path)
    if (current.isSymbolicLink()) return {ok: false, path, reason: 'symlink'}
    if (!current.isFile() || !sameFile(opened, current)) return {ok: false, path, reason: 'not_regular'}
    return undefined
    // System inspection failures are returned as structured read failures.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return unreadable(path, error)
  }
}

function inspectOpenedRepositoryPath(
  root: string,
  rootIdentity: Stats,
  path: string,
  opened: Stats,
): SafeReadFailure | undefined {
  const unsafePath = inspectPathForSymlinks(root, path)
  if (unsafePath) return unsafePath

  try {
    // Node does not expose openat(2), so it cannot bind traversal and opening
    // into one kernel operation. Repeating canonicalization and comparing both
    // names to the open handle detects ancestor replacement before, during, or
    // after open to the practical cross-platform limit. O_NOFOLLOW separately
    // closes the final-component race on platforms that provide it.
    if (realpathSync(root) !== root) return unreadable(path, undefined, 'The canonical repository root changed')
    const currentRoot = lstatSync(root)
    if (!currentRoot.isDirectory() || !sameFile(rootIdentity, currentRoot)) {
      return unreadable(path, undefined, 'The canonical repository root changed')
    }

    const canonicalPath = realpathSync(path)
    if (!isContained(root, canonicalPath)) return {ok: false, path, reason: 'outside_root'}

    const namedPath = lstatSync(path)
    const canonicalNamedPath = lstatSync(canonicalPath)
    if (namedPath.isSymbolicLink() || canonicalNamedPath.isSymbolicLink()) return {ok: false, path, reason: 'symlink'}
    if (
      !namedPath.isFile() ||
      !canonicalNamedPath.isFile() ||
      !sameFile(opened, namedPath) ||
      !sameFile(opened, canonicalNamedPath)
    ) {
      return {ok: false, path, reason: 'not_regular'}
    }

    const canonicalPathAfterIdentityCheck = realpathSync(path)
    if (canonicalPathAfterIdentityCheck !== canonicalPath || !isContained(root, canonicalPathAfterIdentityCheck)) {
      return {ok: false, path, reason: 'outside_root'}
    }
    return undefined
    // Failed canonicalization must fail closed without returning raw OS errors.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return unreadable(path, error)
  }
}

function readOpenedRegularFile(
  path: string,
  maximumBytes: number,
  before: Stats,
  inspectAfterOpen: (opened: Stats) => SafeReadFailure | undefined,
  hooks?: RepositoryIOTestHooks,
): SafeReadResult {
  let fileDescriptor: number | undefined
  try {
    // O_NOFOLLOW is not implemented by Node on Windows. NTFS still supplies a
    // stable file ID, so the lstat/fstat identity checks below preserve normal
    // Windows support while failing closed on filesystems that supply no ID.
    const noFollowFlag = process.platform === 'win32' ? 0 : constants.O_NOFOLLOW
    fileDescriptor = openSync(path, constants.O_RDONLY | noFollowFlag)
    const opened = fstatSync(fileDescriptor)
    if (!opened.isFile()) return {ok: false, path, reason: 'not_regular'}
    if (!hasFileIdentity(before) || !hasFileIdentity(opened)) return identityFailure(path)
    if (!sameFile(before, opened)) return {ok: false, path, reason: 'not_regular'}

    hooks?.afterReadOpen?.()
    const unsafeOpenedPath = inspectAfterOpen(opened)
    if (unsafeOpenedPath) return unsafeOpenedPath

    if (opened.size > maximumBytes) return {ok: false, path, reason: 'too_large', sizeBytes: opened.size}

    const content = Buffer.alloc(maximumBytes + 1)
    let bytesRead = 0
    while (bytesRead <= maximumBytes) {
      const count = readSync(fileDescriptor, content, bytesRead, content.length - bytesRead, null)
      if (count === 0) break
      bytesRead += count
    }
    if (bytesRead > maximumBytes) return {ok: false, path, reason: 'too_large', sizeBytes: bytesRead}

    const after = fstatSync(fileDescriptor)
    if (!after.isFile() || !sameFile(opened, after)) return {ok: false, path, reason: 'not_regular'}
    const unsafeReadPath = inspectAfterOpen(after)
    if (unsafeReadPath) return unsafeReadPath

    const descriptorToClose = fileDescriptor
    fileDescriptor = undefined
    closeSync(descriptorToClose)
    return {ok: true, path, content: content.subarray(0, bytesRead), sizeBytes: bytesRead}
    // System read failures are returned to discovery as structured coverage gaps.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return unreadable(path, error)
  } finally {
    if (fileDescriptor !== undefined) {
      try {
        closeSync(fileDescriptor)
        // A read has already failed or been rejected; do not let a raw close
        // error replace its structured result.
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        // Best-effort close after the operation has already failed.
      }
    }
  }
}

/** Read an arbitrary bounded file without following a final-component symlink. */
export function safeReadFile(path: string, maximumBytes: number): SafeReadResult {
  const absolutePath = resolvePath(path)
  let before: Stats
  try {
    before = lstatSync(absolutePath)
    // System inspection failures are returned as structured read failures.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return unreadable(absolutePath, error)
  }
  if (before.isSymbolicLink()) return {ok: false, path: absolutePath, reason: 'symlink'}
  if (!before.isFile()) return {ok: false, path: absolutePath, reason: 'not_regular'}
  return readOpenedRegularFile(absolutePath, maximumBytes, before, (opened) => inspectOpenedPath(absolutePath, opened))
}

/** Read repository evidence only when the complete path remains inside the canonical app root. */
export function safeReadRepositoryFile(
  canonicalRoot: string,
  path: string,
  maximumBytes = MAX_REPOSITORY_FILE_SIZE_BYTES,
  hooks?: RepositoryIOTestHooks,
): SafeReadResult {
  const root = resolvePath(canonicalRoot)
  const absolutePath = resolvePath(path)
  if (!isContained(root, absolutePath)) return {ok: false, path: absolutePath, reason: 'outside_root'}

  let rootIdentity: Stats
  let before: Stats
  try {
    if (realpathSync(root) !== root) return unreadable(absolutePath, undefined, 'Repository root is not canonical')
    rootIdentity = lstatSync(root)
    if (!rootIdentity.isDirectory() || !hasFileIdentity(rootIdentity)) return identityFailure(absolutePath)

    const unsafePath = inspectPathForSymlinks(root, absolutePath)
    if (unsafePath) return unsafePath
    const canonicalPath = realpathSync(absolutePath)
    if (!isContained(root, canonicalPath)) return {ok: false, path: absolutePath, reason: 'outside_root'}
    before = lstatSync(absolutePath)
    // Failed canonicalization must fail closed as an unreadable path.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return unreadable(absolutePath, error)
  }

  if (before.isSymbolicLink()) return {ok: false, path: absolutePath, reason: 'symlink'}
  if (!before.isFile()) return {ok: false, path: absolutePath, reason: 'not_regular'}
  return readOpenedRegularFile(
    absolutePath,
    maximumBytes,
    before,
    (opened) => inspectOpenedRepositoryPath(root, rootIdentity, absolutePath, opened),
    hooks,
  )
}

function validateWriteTarget(path: string): void {
  try {
    const target = lstatSync(path)
    if (target.isSymbolicLink()) throw new Error(`Refusing to replace symlink: ${path}`)
    if (!target.isFile()) throw new Error(`Refusing to replace non-regular file: ${path}`)
    // ENOENT is the only acceptable inspection failure: it means the atomic
    // rename will create a new destination entry.
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

function validateUnchangedParent(requestedParent: string, canonicalParent: string, parentIdentity: Stats): void {
  let currentCanonicalParent: string
  let currentParent: Stats
  try {
    currentCanonicalParent = realpathSync(requestedParent)
    currentParent = lstatSync(canonicalParent)
    // Convert raw filesystem failures into one stable refusal.
  } catch {
    throw new Error(`Refusing to write because the destination directory changed: ${requestedParent}`)
  }
  if (
    currentCanonicalParent !== canonicalParent ||
    !currentParent.isDirectory() ||
    !hasFileIdentity(currentParent) ||
    !sameFile(parentIdentity, currentParent)
  ) {
    throw new Error(`Refusing to write because the destination directory changed: ${requestedParent}`)
  }
}

function inspectCreatedTemporaryFile(temporaryPath: string, temporaryIdentity: Stats): void {
  const current = lstatSync(temporaryPath)
  if (!current.isFile() || !hasFileIdentity(current) || !sameFile(temporaryIdentity, current)) {
    throw new Error(`Refusing to rename a replaced temporary file: ${temporaryPath}`)
  }
}

function cleanupCreatedTemporaryFile(temporaryPath: string, temporaryIdentity: Stats | undefined): void {
  if (!temporaryIdentity) return
  try {
    const current = lstatSync(temporaryPath)
    // An ancestor may have been exchanged after creation. Only unlink the
    // pathname when it still names this invocation's inode; otherwise cleanup
    // could delete an attacker's replacement file.
    if (hasFileIdentity(current) && sameFile(temporaryIdentity, current)) unlinkSync(temporaryPath)
    // Cleanup is best-effort and must not obscure the original write refusal.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // The original write refusal is more useful than a cleanup error.
  }
}

interface ExpectedWriteParent {
  path: string
  identity: Stats
}

/** Atomically replace a regular file without ever opening the destination for writing. */
export function atomicWriteFile(path: string, content: string, hooks?: RepositoryIOTestHooks): void {
  atomicWriteFileInternal(path, content, hooks)
}

function atomicWriteFileInternal(
  path: string,
  content: string,
  hooks?: RepositoryIOTestHooks,
  expectedParent?: ExpectedWriteParent,
): void {
  const absolutePath = resolvePath(path)
  const requestedParent = dirname(absolutePath)
  const canonicalParent = realpathSync(requestedParent)
  const parentIdentity = lstatSync(canonicalParent)
  if (
    !parentIdentity.isDirectory() ||
    !hasFileIdentity(parentIdentity) ||
    (expectedParent && (expectedParent.path !== canonicalParent || !sameFile(expectedParent.identity, parentIdentity)))
  ) {
    throw new Error(`Refusing to write to an unverifiable destination directory: ${requestedParent}`)
  }

  const target = resolvePath(canonicalParent, basename(absolutePath))
  validateUnchangedParent(requestedParent, canonicalParent, parentIdentity)
  validateWriteTarget(target)

  const temporaryPath = resolvePath(canonicalParent, `.${basename(target)}.${randomBytes(16).toString('hex')}.tmp`)
  let fileDescriptor: number | undefined
  let temporaryIdentity: Stats | undefined
  try {
    fileDescriptor = openSync(temporaryPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600)
    temporaryIdentity = fstatSync(fileDescriptor)
    if (!temporaryIdentity.isFile() || !hasFileIdentity(temporaryIdentity)) {
      throw new Error(`Refusing to use an unverifiable temporary file: ${temporaryPath}`)
    }

    const bytes = Buffer.from(content)
    let offset = 0
    while (offset < bytes.length) {
      const bytesWritten = writeSync(fileDescriptor, bytes, offset)
      if (bytesWritten === 0) throw new Error(`Couldn't write temporary file: ${temporaryPath}`)
      offset += bytesWritten
    }
    fsyncSync(fileDescriptor)
    const descriptorToClose = fileDescriptor
    fileDescriptor = undefined
    closeSync(descriptorToClose)

    hooks?.afterTemporaryFileClosed?.(temporaryPath)

    // There is no renameat-style directory-handle API in Node. The random,
    // exclusive sibling temp means a destination symlink is never opened, and
    // these identity checks immediately before rename detect practical parent
    // and destination exchanges. rename itself replaces a raced final symlink
    // rather than following it.
    validateUnchangedParent(requestedParent, canonicalParent, parentIdentity)
    inspectCreatedTemporaryFile(temporaryPath, temporaryIdentity)
    validateWriteTarget(target)
    renameSync(temporaryPath, target)

    validateUnchangedParent(requestedParent, canonicalParent, parentIdentity)
    const writtenTarget = lstatSync(target)
    if (!sameFile(temporaryIdentity, writtenTarget))
      throw new Error(`Destination changed during atomic write: ${target}`)
  } catch (error) {
    if (fileDescriptor !== undefined) {
      try {
        closeSync(fileDescriptor)
        // Preserve the original write failure.
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        // Best-effort close after the operation has already failed.
      }
    }
    cleanupCreatedTemporaryFile(temporaryPath, temporaryIdentity)
    throw error
  }
}

/** Write a scanner-owned artifact as a direct child of the canonical app root. */
export function atomicWriteAppArtifact(
  canonicalRoot: string,
  filename: string,
  content: string,
  hooks?: RepositoryIOTestHooks,
): string {
  if (basename(filename) !== filename || filename === '.' || filename === '..') {
    throw new Error(`Invalid App Doctor artifact filename: ${filename}`)
  }
  const root = canonicalAppRoot(canonicalRoot)
  if (root !== resolvePath(canonicalRoot))
    throw new Error(`App Doctor artifact root is not canonical: ${canonicalRoot}`)
  const rootIdentity = lstatSync(root)
  if (!hasFileIdentity(rootIdentity))
    throw new Error(`App Doctor artifact root identity is unavailable: ${canonicalRoot}`)
  const artifactPath = resolvePath(root, filename)
  if (dirname(artifactPath) !== root) throw new Error(`Artifact is outside the app root: ${artifactPath}`)
  atomicWriteFileInternal(artifactPath, content, hooks, {path: root, identity: rootIdentity})
  return artifactPath
}
