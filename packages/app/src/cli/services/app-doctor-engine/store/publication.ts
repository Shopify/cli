/**
 * Cooperative stage/retain/publish protocol for one store file.
 *
 * A per-key guard (`.publication/<leaf>/lock`, an exclusively created file
 * holding a random token) serialises writers. Under the guard the current file
 * is read, the incoming bytes are staged next to it, the prior current is
 * retained as `previous`, the current file is re-checked for outside changes,
 * and the stage is renamed into place. Guards are never stolen or expired;
 * a writer that cannot acquire one within its wait budget reports `locked`.
 */
import {stageLeaf} from './codec.js'
import {
  createStoreFile,
  ensureStoreDirectory,
  inspectStorePath,
  readStoreFile,
  removeStoreFile,
  renameStoreFile,
} from './files.js'
import {randomHex} from '@shopify/cli-kit/node/crypto'
import {joinPath} from '@shopify/cli-kit/node/path'
import {setTimeout as sleep} from 'node:timers/promises'
import type {AppDoctorPublicationReceipt, AppDoctorStoreDiagnostic, AppDoctorStoreOptions} from './types.js'
import type {AppDoctorContext} from '../context/types.js'
import type {Stats} from 'node:fs'

export interface PublicationTarget {
  readonly anchor: string
  /** Directory holding the current file. */
  readonly directory: string
  readonly currentPath: string
  readonly stagePath: string
  readonly stateDirectory: string
  readonly lockPath: string
  readonly previousPath: string
  readonly previousStagePath: string
}

/** The current file as read under the guard; `undefined` when no current file exists. */
export type CurrentSnapshot = {readonly bytes: Buffer; readonly stats: Stats} | undefined

export type PreparedPublication = {ok: true; bytes: Buffer} | {ok: false; diagnostics: AppDoctorStoreDiagnostic[]}

/** Produces the bytes to publish given the current file; may reject based on it. */
export type PreparePublication = (current: CurrentSnapshot) => PreparedPublication | Promise<PreparedPublication>

/**
 * Hooks that let tests interleave real filesystem activity with the protocol.
 * Internal to the store: never exported from the engine's index and never set
 * by production callers.
 */
export interface PublicationSeams {
  /** Runs after the incoming bytes are staged and before the current file is re-checked and replaced. */
  readonly beforeCommit?: () => Promise<void> | void
  /** Runs before each enumerated file is read, so tests can make a listed file vanish. */
  readonly beforeRead?: (path: string) => Promise<void> | void
}

const STATE_DIRECTORY = '.publication'
const LOCK_FILE = 'lock'
const PREVIOUS_FILE = 'previous'
const LOCK_TOKEN_BYTES = 16
/**
 * Generous enough that a foreign token of any plausible length is read and
 * reported as a `non-cooperative-change` rather than as an `oversized` file.
 */
const LOCK_READ_LIMIT_BYTES = 256
const DEFAULT_LOCK_WAIT_MILLISECONDS = 2000
const INITIAL_LOCK_RETRY_MILLISECONDS = 10
const MAX_LOCK_RETRY_MILLISECONDS = 250

/** All paths involved in publishing `leaf` inside `directory`, derived from the context alone. */
export function resolvePublicationTarget(
  context: AppDoctorContext,
  directory: string,
  leaf: string,
): PublicationTarget {
  const stateDirectory = joinPath(context.storeDirectory, STATE_DIRECTORY, leaf)
  return {
    anchor: context.storageAnchor,
    directory,
    currentPath: joinPath(directory, leaf),
    stagePath: joinPath(directory, stageLeaf(leaf)),
    stateDirectory,
    lockPath: joinPath(stateDirectory, LOCK_FILE),
    previousPath: joinPath(stateDirectory, PREVIOUS_FILE),
    previousStagePath: joinPath(stateDirectory, `${PREVIOUS_FILE}.next`),
  }
}

const failed = (...diagnostics: AppDoctorStoreDiagnostic[]): AppDoctorPublicationReceipt => ({
  status: 'failed',
  diagnostics,
})

type GuardAcquisition = {ok: true; token: string} | {ok: false; diagnostic: AppDoctorStoreDiagnostic}

/** Exclusively create the lock file; on `EEXIST` back off within the wait budget, then give up with `locked`. */
async function acquireGuard(target: PublicationTarget, waitMilliseconds: number): Promise<GuardAcquisition> {
  const token = randomHex(LOCK_TOKEN_BYTES)
  const deadline = Date.now() + waitMilliseconds
  let delay = INITIAL_LOCK_RETRY_MILLISECONDS
  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- each attempt depends on the previous one failing
    const created = await createStoreFile(target.anchor, target.lockPath, Buffer.from(token, 'utf8'))
    if (created.ok) return {ok: true, token}
    if (created.diagnostic.errno !== 'EEXIST') return created
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      return {
        ok: false,
        diagnostic: {code: 'locked', path: target.lockPath, message: 'Another writer holds the publication guard.'},
      }
    }
    // eslint-disable-next-line no-await-in-loop -- bounded backoff between attempts
    await sleep(Math.min(delay, remaining))
    delay = Math.min(delay * 2, MAX_LOCK_RETRY_MILLISECONDS)
  }
}

/** Remove the guard only if it still carries our token. Anything else is reported, never forced. */
async function releaseGuard(target: PublicationTarget, token: string): Promise<AppDoctorStoreDiagnostic | undefined> {
  const lock = await readStoreFile(target.anchor, target.lockPath, LOCK_READ_LIMIT_BYTES)
  if (lock.status === 'error') return lock.diagnostic
  const replaced = {
    code: 'non-cooperative-change',
    path: target.lockPath,
    message: 'The publication guard no longer holds this writer’s token.',
  } as const
  if (lock.status === 'absent' || lock.bytes.toString('utf8') !== token) return replaced
  const removed = await removeStoreFile(target.anchor, target.lockPath)
  return removed.ok ? undefined : removed.diagnostic
}

/** Delete a stage file left behind by an earlier crash. Only the guard holder may do this. */
async function clearStaleStage(anchor: string, stagePath: string): Promise<AppDoctorStoreDiagnostic | undefined> {
  const stage = await inspectStorePath(anchor, stagePath)
  if (!stage.ok) return stage.diagnostic
  if (stage.value.kind === 'absent') return undefined
  if (stage.value.kind !== 'file') return {code: 'unsafe-path', path: stagePath, message: 'Stage path is not a file.'}
  const removed = await removeStoreFile(anchor, stagePath)
  return removed.ok ? undefined : removed.diagnostic
}

/**
 * Copy the prior current bytes into `previous` through an exclusive stage and a
 * rename. This happens before the commit re-check, so a publication that then
 * fails with `non-cooperative-change` has already rotated `previous` to the
 * snapshot read under the guard; the rotation is not undone.
 */
async function retainPrevious(target: PublicationTarget, bytes: Buffer): Promise<AppDoctorStoreDiagnostic | undefined> {
  const stale = await clearStaleStage(target.anchor, target.previousStagePath)
  if (stale) return stale
  const staged = await createStoreFile(target.anchor, target.previousStagePath, bytes)
  if (!staged.ok) return staged.diagnostic
  const renamed = await renameStoreFile(target.anchor, target.previousStagePath, target.previousPath)
  return renamed.ok ? undefined : renamed.diagnostic
}

/** True when the current file is exactly as it was when the snapshot was taken (or still absent). */
async function currentUnchanged(target: PublicationTarget, snapshot: CurrentSnapshot): Promise<boolean> {
  const current = await readStoreFile(target.anchor, target.currentPath)
  if (snapshot === undefined) return current.status === 'absent'
  if (current.status !== 'present') return false
  return (
    current.stats.size === snapshot.stats.size &&
    current.stats.mtimeMs === snapshot.stats.mtimeMs &&
    current.bytes.equals(snapshot.bytes)
  )
}

async function publishGuarded(
  target: PublicationTarget,
  prepare: PreparePublication,
  seams: PublicationSeams,
): Promise<AppDoctorPublicationReceipt> {
  const current = await readStoreFile(target.anchor, target.currentPath)
  if (current.status === 'error') return failed(current.diagnostic)
  const snapshot: CurrentSnapshot = current.status === 'present' ? current : undefined

  const prepared = await prepare(snapshot)
  if (!prepared.ok) return failed(...prepared.diagnostics)
  if (snapshot?.bytes.equals(prepared.bytes)) return {status: 'unchanged', warnings: []}

  const stale = await clearStaleStage(target.anchor, target.stagePath)
  if (stale) return failed(stale)
  const staged = await createStoreFile(target.anchor, target.stagePath, prepared.bytes)
  if (!staged.ok) return failed(staged.diagnostic)

  const abandonStage = async (diagnostic: AppDoctorStoreDiagnostic) => {
    const removed = await removeStoreFile(target.anchor, target.stagePath)
    return removed.ok ? failed(diagnostic) : failed(diagnostic, removed.diagnostic)
  }

  if (snapshot) {
    const retained = await retainPrevious(target, snapshot.bytes)
    if (retained) return abandonStage(retained)
  }

  if (seams.beforeCommit) await seams.beforeCommit()

  if (!(await currentUnchanged(target, snapshot))) {
    return abandonStage({
      code: 'non-cooperative-change',
      path: target.currentPath,
      message: 'The current file changed outside the publication guard.',
    })
  }
  const committed = await renameStoreFile(target.anchor, target.stagePath, target.currentPath)
  if (!committed.ok) return abandonStage(committed.diagnostic)

  return snapshot
    ? {status: 'replaced', previous: {status: 'retained', path: target.previousPath}, warnings: []}
    : {status: 'created', warnings: []}
}

/**
 * Publish the bytes `prepare` derives from the current file, under the key's
 * guard. The key's directories and guard are created before `prepare` runs;
 * when `prepare` rejects, no document is staged or written and the guard is
 * released, but the directories remain. Nothing is written when the guard
 * cannot be acquired.
 */
export async function publishUnderGuard(
  target: PublicationTarget,
  options: AppDoctorStoreOptions,
  prepare: PreparePublication,
  seams: PublicationSeams = {},
): Promise<AppDoctorPublicationReceipt> {
  for (const directory of [target.directory, target.stateDirectory]) {
    // eslint-disable-next-line no-await-in-loop -- two directories, created in order
    const ensured = await ensureStoreDirectory(target.anchor, directory)
    if (!ensured.ok) return failed(ensured.diagnostic)
  }

  const guard = await acquireGuard(target, options.lockWaitMilliseconds ?? DEFAULT_LOCK_WAIT_MILLISECONDS)
  if (!guard.ok) return failed(guard.diagnostic)

  let receipt: AppDoctorPublicationReceipt
  try {
    receipt = await publishGuarded(target, prepare, seams)
  } catch (error) {
    // A throwing `prepare` is a programmer error; still release the guard so the key is not wedged.
    await releaseGuard(target, guard.token)
    throw error
  }
  return attachReleaseWarning(receipt, await releaseGuard(target, guard.token))
}

function attachReleaseWarning(
  receipt: AppDoctorPublicationReceipt,
  warning: AppDoctorStoreDiagnostic | undefined,
): AppDoctorPublicationReceipt {
  if (warning === undefined) return receipt
  if (receipt.status === 'failed') return {...receipt, diagnostics: [...receipt.diagnostics, warning]}
  return {...receipt, warnings: [...receipt.warnings, warning]}
}
