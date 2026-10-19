/* eslint-disable no-await-in-loop -- Each recovery step depends on the preceding owner; release must remove ancestors first. */
import {randomUUID} from '../../public/node/crypto.js'
import {mkdir, readFile, rmdir} from '../../public/node/fs.js'
import {joinPath} from '../../public/node/path.js'
import {rename, writeFile} from 'fs/promises'

interface LockOwner {
  pid: number
  sessionId: string
}

/**
 * Serializes startup, including recovery of an abandoned dev-instance lock.
 *
 * @param lockFile - The instance's lock path.
 * @param action - Startup work to complete before another process can acquire the guard.
 * @returns The result of startup.
 */
export async function withDevInstanceStartupLock<T>(lockFile: string, action: () => Promise<T>): Promise<T> {
  const owner: LockOwner = {pid: process.pid, sessionId: randomUUID()}
  const ownerDirectory = `${lockFile}.${owner.sessionId}.owner`
  await mkdir(ownerDirectory)
  let claimFile = `${lockFile}.acquire`
  const abandoned: {path: string; owner: LockOwner}[] = []
  let claimed = false
  let validated = false
  try {
    await writeFile(joinPath(ownerDirectory, 'owner.json'), JSON.stringify(owner), {mode: 0o600, flag: 'wx'})
    while (!claimed) {
      try {
        // Rename publishes the complete record atomically and cannot replace another nonempty claim directory.
        await rename(ownerDirectory, claimFile)
        claimed = true
      } catch (error) {
        if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
        const previous = await readOwner(claimFile)
        if (!previous) {
          if ((error as NodeJS.ErrnoException).code === 'EPERM') throw error
          continue
        }
        if (isProcessAlive(previous.pid)) throw locked()
        abandoned.push({path: claimFile, owner: previous})
        // Never delete a claim while acquiring: a crashed recovery gets its own successor claim.
        const nextClaim = `${lockFile}.${previous.sessionId}.acquire`
        if (abandoned.some(({path}) => path === nextClaim)) throw locked()
        claimFile = nextClaim
      }
    }
    for (const previous of abandoned) {
      if ((await readOwner(previous.path))?.sessionId !== previous.owner.sessionId) throw locked()
    }
    validated = true
    return await action()
  } finally {
    // Remove ancestors first. A contender that read an old ancestor must fail validation before entering.
    if (validated) {
      for (const previous of abandoned) {
        const abandonedDirectory = `${lockFile}.${previous.owner.sessionId}.owner`
        await rename(previous.path, abandonedDirectory)
        await rmdir(abandonedDirectory, {force: true})
      }
    }
    if (claimed) await rename(claimFile, ownerDirectory)
    await rmdir(ownerDirectory, {force: true})
  }
}

/**
 * Checks whether a process exists. A process owned by another user counts as alive.
 *
 * @param pid - The process ID.
 * @returns True when the process exists.
 */
export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

async function readOwner(path: string): Promise<LockOwner | undefined> {
  let content: string
  try {
    content = await readFile(joinPath(path, 'owner.json'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  const owner = JSON.parse(content) as LockOwner
  if (!Number.isInteger(owner.pid) || owner.pid <= 0 || !/^[\da-f-]{36}$/.test(owner.sessionId)) throw locked()
  return owner
}

function locked() {
  return Object.assign(new Error('Another process is acquiring the dev instance lock'), {code: 'ELOCKED'})
}
