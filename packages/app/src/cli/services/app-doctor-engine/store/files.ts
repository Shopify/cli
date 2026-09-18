/**
 * Filesystem primitives confined to the storage anchor.
 *
 * Every operation re-validates the whole path beneath the anchor with `lstat`:
 * no `..` components, no symlinks anywhere, directories where directories are
 * expected. Reads are bounded and verified against the opened descriptor;
 * writes are exclusive, private (0700/0600), and fsynced. Filesystem failures
 * are returned as diagnostics; only programmer errors propagate.
 */
import {MAX_STORE_FILE_BYTES} from './codec.js'
import {systemErrorCode} from '../context/fs-errors.js'
import {compareStrings} from '../context/ordering.js'
import {dirname, isAbsolutePath, joinPath, normalizePath, relativePath} from '@shopify/cli-kit/node/path'
import {constants} from 'node:fs'
import {lstat, mkdir, open, readdir, rename, unlink} from 'node:fs/promises'
import type {AppDoctorStoreDiagnostic, AppDoctorStoreErrorCode} from './types.js'
import type {FileHandle} from 'node:fs/promises'
import type {Stats} from 'node:fs'

export type StoreFileOutcome<T> = {ok: true; value: T} | {ok: false; diagnostic: AppDoctorStoreDiagnostic}

export type StorePathInspection = {kind: 'absent'} | {kind: 'file'; stats: Stats} | {kind: 'directory'; stats: Stats}

export type StoreFileRead =
  | {status: 'present'; bytes: Buffer; stats: Stats}
  | {status: 'absent'}
  | {status: 'error'; diagnostic: AppDoctorStoreDiagnostic}

export interface StoreDirectoryEntry {
  readonly name: string
  readonly kind: 'file' | 'directory' | 'other'
}

export type StoreDirectoryListing =
  | {status: 'present'; entries: StoreDirectoryEntry[]}
  | {status: 'absent'}
  | {status: 'error'; diagnostic: AppDoctorStoreDiagnostic}

const READ_CHUNK_BYTES = 64 * 1024
const PRIVATE_DIRECTORY_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600
// `O_NOFOLLOW` is undefined on Windows; the lstat/fstat identity check still applies there.
const OPEN_READ_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)

const failure = <T>(diagnostic: AppDoctorStoreDiagnostic): StoreFileOutcome<T> => ({ok: false, diagnostic})
const success = <T>(value: T): StoreFileOutcome<T> => ({ok: true, value})

const unsafePath = (path: string, message: string): AppDoctorStoreDiagnostic => ({code: 'unsafe-path', path, message})

export type Attempt<T> = {ok: true; value: T} | {ok: false; errno: string}

/**
 * True for Node system errors: the ones libuv raises with a numeric `errno` or
 * a `syscall`. Node's own programmer errors (`ERR_INVALID_ARG_TYPE`, ...) carry
 * a `code` too, so a `code` alone is not evidence of a filesystem failure.
 */
const isSystemError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (typeof (error as {errno?: unknown}).errno === 'number' || 'syscall' in error)

/**
 * Run one filesystem call. Node system errors (those carrying an errno code)
 * become outcomes; anything else is a programmer error and propagates.
 */
export async function attempt<T>(operation: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return {ok: true, value: await operation()}
  } catch (error) {
    const errno = isSystemError(error) ? systemErrorCode(error) : undefined
    if (errno === undefined) throw error
    return {ok: false, errno}
  }
}

/** Classify an errno: permission problems are `inaccessible`, everything else `io`. */
const systemDiagnostic = (path: string, action: string, errno: string): AppDoctorStoreDiagnostic => {
  const code: AppDoctorStoreErrorCode = errno === 'EACCES' || errno === 'EPERM' ? 'inaccessible' : 'io'
  return {code, path, message: `Couldn't ${action} (${errno}).`, errno}
}

const isMissing = (errno: string) => errno === 'ENOENT' || errno === 'ENOTDIR'

/**
 * The path components of `path` strictly beneath `anchor` (empty when equal), or
 * `undefined` when either path is relative or `path` escapes the anchor.
 */
export function storePathComponents(anchor: string, path: string): string[] | undefined {
  if (!isAbsolutePath(anchor) || !isAbsolutePath(path)) return undefined
  const relative = relativePath(normalizePath(anchor), normalizePath(path))
  if (relative === '') return []
  if (isAbsolutePath(relative)) return undefined
  const components = relative.split('/')
  const escapes = components.some((component) => component === '' || component === '.' || component === '..')
  return escapes ? undefined : components
}

/** The anchor followed by each ancestor of `path` down to `path` itself. */
function componentPaths(anchor: string, components: ReadonlyArray<string>): string[] {
  return components.reduce<string[]>(
    (paths, component) => [...paths, joinPath(paths.at(-1) ?? anchor, component)],
    [normalizePath(anchor)],
  )
}

type Lstat = {kind: 'absent'} | {kind: 'present'; stats: Stats} | {kind: 'error'; diagnostic: AppDoctorStoreDiagnostic}

async function lstatPath(path: string): Promise<Lstat> {
  const attempted = await attempt(() => lstat(path))
  if (attempted.ok) return {kind: 'present', stats: attempted.value}
  if (isMissing(attempted.errno)) return {kind: 'absent'}
  return {kind: 'error', diagnostic: systemDiagnostic(path, 'inspect the path', attempted.errno)}
}

const requireDirectory = (path: string, stats: Stats): AppDoctorStoreDiagnostic | undefined => {
  if (stats.isSymbolicLink()) return unsafePath(path, 'Path component is a symbolic link.')
  if (!stats.isDirectory()) return unsafePath(path, 'Path component is not a directory.')
  return undefined
}

/**
 * Walk from the anchor to `path`, verifying every intermediate component is a
 * real directory, and classify the final component without following links.
 */
export async function inspectStorePath(anchor: string, path: string): Promise<StoreFileOutcome<StorePathInspection>> {
  const components = storePathComponents(anchor, path)
  if (components === undefined) return failure(unsafePath(path, 'Path is not beneath the storage anchor.'))
  const paths = componentPaths(anchor, components)
  const leaf = paths.at(-1) ?? anchor

  for (const parent of paths.slice(0, -1)) {
    // eslint-disable-next-line no-await-in-loop -- components must be checked in order, parent before child
    const inspection = await lstatPath(parent)
    if (inspection.kind === 'absent') return success({kind: 'absent'})
    if (inspection.kind === 'error') return failure(inspection.diagnostic)
    const violation = requireDirectory(parent, inspection.stats)
    if (violation) return failure(violation)
  }

  const inspection = await lstatPath(leaf)
  if (inspection.kind === 'absent') return success({kind: 'absent'})
  if (inspection.kind === 'error') return failure(inspection.diagnostic)
  const {stats} = inspection
  if (stats.isSymbolicLink()) return failure(unsafePath(leaf, 'Path is a symbolic link.'))
  if (stats.isDirectory()) return success({kind: 'directory', stats})
  if (stats.isFile()) return success({kind: 'file', stats})
  return failure(unsafePath(leaf, 'Path is neither a regular file nor a directory.'))
}

async function ensureDirectoryComponent(path: string): Promise<AppDoctorStoreDiagnostic | undefined> {
  const existing = await lstatPath(path)
  if (existing.kind === 'error') return existing.diagnostic
  if (existing.kind === 'present') return requireDirectory(path, existing.stats)
  const created = await attempt(() => mkdir(path, {mode: PRIVATE_DIRECTORY_MODE}))
  // A concurrent writer may have created it first; re-inspect instead of failing.
  if (!created.ok && created.errno !== 'EEXIST') return systemDiagnostic(path, 'create the directory', created.errno)
  const inspection = await lstatPath(path)
  if (inspection.kind === 'error') return inspection.diagnostic
  if (inspection.kind === 'absent') return {code: 'io', path, message: 'Directory vanished after creation.'}
  return requireDirectory(path, inspection.stats)
}

/** Create every missing component of `directory` beneath the anchor as a private directory. */
export async function ensureStoreDirectory(anchor: string, directory: string): Promise<StoreFileOutcome<void>> {
  const components = storePathComponents(anchor, directory)
  if (components === undefined) return failure(unsafePath(directory, 'Path is not beneath the storage anchor.'))
  for (const path of componentPaths(anchor, components)) {
    // eslint-disable-next-line no-await-in-loop -- components must be created in order, parent before child
    const violation = await ensureDirectoryComponent(path)
    if (violation) return failure(violation)
  }
  return success(undefined)
}

/** Close a handle whose outcome has already been decided; a close failure changes nothing. */
const closeQuietly = (handle: FileHandle): Promise<unknown> => attempt(() => handle.close())

/** True when lstat and fstat describe the same inode, or when the platform reports no inode numbers. */
const sameFile = (expected: Stats, opened: Stats): boolean =>
  expected.ino === 0 || opened.ino === 0 || (expected.ino === opened.ino && expected.dev === opened.dev)

/** Read the whole descriptor, or `undefined` as soon as it proves to hold more than `limit` bytes. */
export async function readBounded(handle: FileHandle, limit: number): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  let total = 0
  while (total <= limit) {
    const chunk = Buffer.alloc(Math.min(READ_CHUNK_BYTES, limit + 1 - total))
    // eslint-disable-next-line no-await-in-loop -- sequential reads of one descriptor
    const {bytesRead} = await handle.read(chunk, 0, chunk.byteLength, null)
    if (bytesRead === 0) return Buffer.concat(chunks, total)
    chunks.push(chunk.subarray(0, bytesRead))
    total += bytesRead
  }
  return undefined
}

async function readOpenFile(handle: FileHandle, expected: Stats, path: string, limit: number): Promise<StoreFileRead> {
  const stats = await attempt(() => handle.stat())
  if (!stats.ok) return {status: 'error', diagnostic: systemDiagnostic(path, 'inspect the file', stats.errno)}
  if (!stats.value.isFile() || !sameFile(expected, stats.value)) {
    return {status: 'error', diagnostic: unsafePath(path, 'File changed identity while being opened.')}
  }
  const bytes = await attempt(() => readBounded(handle, limit))
  if (!bytes.ok) return {status: 'error', diagnostic: systemDiagnostic(path, 'read the file', bytes.errno)}
  if (bytes.value === undefined) {
    return {status: 'error', diagnostic: {code: 'oversized', path, message: `File exceeds ${limit} bytes.`}}
  }
  return {status: 'present', bytes: bytes.value, stats: stats.value}
}

/**
 * Read a regular file of at most `limit` bytes. The descriptor is opened
 * without following links and checked against the lstat identity so a swap
 * between inspection and open cannot redirect the read.
 */
export async function readStoreFile(
  anchor: string,
  path: string,
  limit = MAX_STORE_FILE_BYTES,
): Promise<StoreFileRead> {
  const inspection = await inspectStorePath(anchor, path)
  if (!inspection.ok) return {status: 'error', diagnostic: inspection.diagnostic}
  if (inspection.value.kind === 'absent') return {status: 'absent'}
  if (inspection.value.kind !== 'file')
    return {status: 'error', diagnostic: unsafePath(path, 'Path is not a regular file.')}
  if (inspection.value.stats.size > limit) {
    return {status: 'error', diagnostic: {code: 'oversized', path, message: `File exceeds ${limit} bytes.`}}
  }

  const opened = await attempt(() => open(path, OPEN_READ_FLAGS))
  if (!opened.ok) {
    if (opened.errno === 'ENOENT') return {status: 'absent'}
    return {status: 'error', diagnostic: systemDiagnostic(path, 'open the file', opened.errno)}
  }
  const read = await readOpenFile(opened.value, inspection.value.stats, path, limit)
  await closeQuietly(opened.value)
  return read
}

async function requireParentDirectory(anchor: string, path: string): Promise<AppDoctorStoreDiagnostic | undefined> {
  const parent = await inspectStorePath(anchor, dirname(path))
  if (!parent.ok) return parent.diagnostic
  if (parent.value.kind !== 'directory') return unsafePath(dirname(path), 'Parent is not a directory.')
  return undefined
}

/** Exclusively create a private file with `bytes`, fsynced before returning. `EEXIST` surfaces as the `errno`. */
export async function createStoreFile(anchor: string, path: string, bytes: Buffer): Promise<StoreFileOutcome<void>> {
  const parentViolation = await requireParentDirectory(anchor, path)
  if (parentViolation) return failure(parentViolation)

  const opened = await attempt(() => open(path, 'wx', PRIVATE_FILE_MODE))
  if (!opened.ok) return failure(systemDiagnostic(path, 'create the file', opened.errno))
  const handle = opened.value
  const written = await attempt(async () => {
    await handle.writeFile(bytes)
    await handle.sync()
  })
  await closeQuietly(handle)
  if (written.ok) return success(undefined)
  // The file is closed before removal so the cleanup also works on Windows.
  await removeStoreFile(anchor, path)
  return failure(systemDiagnostic(path, 'write the file', written.errno))
}

/** Best-effort durability for a completed rename; not every platform lets a directory be fsynced. */
async function syncDirectory(directory: string): Promise<void> {
  const opened = await attempt(() => open(directory, 'r'))
  if (!opened.ok) return
  await attempt(() => opened.value.sync())
  await closeQuietly(opened.value)
}

/** Atomically move a regular file over `to` (which may or may not exist) within the same store directory. */
export async function renameStoreFile(anchor: string, from: string, to: string): Promise<StoreFileOutcome<void>> {
  const source = await inspectStorePath(anchor, from)
  if (!source.ok) return failure(source.diagnostic)
  if (source.value.kind !== 'file') return failure(unsafePath(from, 'Rename source is not a regular file.'))
  const parentViolation = await requireParentDirectory(anchor, to)
  if (parentViolation) return failure(parentViolation)
  const renamed = await attempt(() => rename(from, to))
  if (!renamed.ok) return failure(systemDiagnostic(to, 'rename the file', renamed.errno))
  await syncDirectory(dirname(to))
  return success(undefined)
}

/** Remove a regular file if present. Absence is success; anything that is not a regular file is refused. */
export async function removeStoreFile(anchor: string, path: string): Promise<StoreFileOutcome<void>> {
  const inspection = await inspectStorePath(anchor, path)
  if (!inspection.ok) return failure(inspection.diagnostic)
  if (inspection.value.kind === 'absent') return success(undefined)
  if (inspection.value.kind !== 'file') return failure(unsafePath(path, 'Path is not a regular file.'))
  const removed = await attempt(() => unlink(path))
  if (removed.ok || removed.errno === 'ENOENT') return success(undefined)
  return failure(systemDiagnostic(path, 'remove the file', removed.errno))
}

const entryKind = (dirent: {isFile: () => boolean; isDirectory: () => boolean}): StoreDirectoryEntry['kind'] => {
  if (dirent.isFile()) return 'file'
  return dirent.isDirectory() ? 'directory' : 'other'
}

/** Entries of a store directory in code-unit order, classified without following links. */
export async function listStoreDirectory(anchor: string, directory: string): Promise<StoreDirectoryListing> {
  const inspection = await inspectStorePath(anchor, directory)
  if (!inspection.ok) return {status: 'error', diagnostic: inspection.diagnostic}
  if (inspection.value.kind === 'absent') return {status: 'absent'}
  if (inspection.value.kind !== 'directory') {
    return {status: 'error', diagnostic: unsafePath(directory, 'Path is not a directory.')}
  }
  const listed = await attempt(() => readdir(directory, {withFileTypes: true}))
  if (!listed.ok) {
    if (listed.errno === 'ENOENT') return {status: 'absent'}
    return {status: 'error', diagnostic: systemDiagnostic(directory, 'list the directory', listed.errno)}
  }
  const entries = listed.value
    .map((dirent) => ({name: dirent.name, kind: entryKind(dirent)}))
    .sort((left, right) => compareStrings(left.name, right.name))
  return {status: 'present', entries}
}
