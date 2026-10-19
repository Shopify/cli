import {getOrCreateHiddenShopifyFolder} from './hidden-folder.js'
import {joinPath} from './path.js'
import {fileExists, glob, mkdir, readFile, removeFile, removeFileSync, renameFile, rmdir} from './fs.js'
import {AbortError} from './error.js'
import {outputDebug, unstyled} from './output.js'
import {formatJsonOutputTimestamp} from './json-output-schema.js'
import {randomUUID} from './crypto.js'
import {isProcessAlive, withDevInstanceStartupLock} from '../../private/node/dev-instance-lock.js'
import lockfile from 'proper-lockfile'
import fs, {createWriteStream, readFileSync, type WriteStream} from 'fs'
import {writeFile as writeFileWithMode} from 'fs/promises'
import {Writable} from 'stream'
import {StringDecoder} from 'string_decoder'

export {isProcessAlive} from '../../private/node/dev-instance-lock.js'

/**
 * A stable error code for JSON consumers when a long-running command refuses to start because another instance of
 * it is already running for the same project.
 */
export const DEV_INSTANCE_ALREADY_RUNNING_CODE = 'dev_instance_already_running'

const DEV_INSTANCES_FOLDER = 'dev'
const DEFAULT_STALE_MS = 30_000

/**
 * Describes a running instance of a long-running command such as `app dev` or `theme dev`.
 * It's written to `.shopify/dev/<slug>.json` so agents and other tools can discover the instance.
 */
export interface DevInstanceInfo {
  schemaVersion: 1
  /** Identifies this run, including when the OS reuses a PID. */
  sessionId: string
  /** The command that owns the instance, for example `app dev`. */
  command: string
  /** Distinguishes instances of the same command in the same directory, for example the app configuration file. */
  key?: string
  pid: number
  status: 'starting' | 'running'
  startedAt: string
  updatedAt: string
  /** The project directory the instance runs for. */
  directory: string
  /** The JSON Lines file the instance appends its output to. */
  logFile: string
  /** Command-specific, JSON-serializable details such as URLs and ports. */
  details: {[key: string]: unknown}
}

/** One line of a dev instance's JSON Lines log. */
export interface DevInstanceLogEntry {
  sessionId: string
  timestamp: string
  /** What produced the line, for example a process prefix like `web` or `extensions`. */
  source: string
  /** The stream the line was written to, when it comes from a process. */
  stream?: 'stdout' | 'stderr'
  level?: 'debug' | 'info' | 'warning' | 'error'
  message: string
}

export interface DevInstancePaths {
  /** The folder that holds every dev instance of the project: `.shopify/dev`. */
  folder: string
  /** The instance description. */
  infoFile: string
  /** The lock directory, owned by `proper-lockfile`. */
  lockFile: string
  /** The JSON Lines log. */
  logFile: string
}

export interface DevInstanceIdentity {
  /** The command that owns the instance, for example `app dev`. */
  command: string
  /** The project directory. */
  directory: string
  /** Distinguishes several instances of the same command in the same directory. */
  key?: string
}

export interface AcquireDevInstanceOptions extends DevInstanceIdentity {
  /** Initial command-specific details. */
  details?: {[key: string]: unknown}
}

export interface DevInstanceUpdate {
  status?: DevInstanceInfo['status']
  /** Merged into the existing details. */
  details?: {[key: string]: unknown}
}

export interface DevInstance {
  readonly info: DevInstanceInfo
  readonly paths: DevInstancePaths
  /** Aborts when this session loses its lock. Consumers must stop their owned work. */
  readonly abortSignal: AbortSignal
  /** Updates and persists the instance description. */
  update: (changes: DevInstanceUpdate) => Promise<void>
  /** Appends one entry to the JSON Lines log. */
  log: (entry: Omit<DevInstanceLogEntry, 'sessionId' | 'timestamp'>) => void
  /**
   * Wraps a stream so every line written to it is also appended to the log, without ANSI styling.
   * The returned stream forwards the original bytes to `target` unchanged.
   */
  tee: (target: Writable, options: {source: string; stream: 'stdout' | 'stderr'}) => Writable
  /** Closes the log, removes the instance description and releases the lock. Safe to call more than once. */
  release: () => Promise<void>
}

/**
 * Returns the files used by a dev instance. Every instance of a project shares `.shopify/dev`,
 * with one `<slug>.json`, `<slug>.lock` and `<slug>.jsonl` per command and key.
 *
 * @param identity - The command, directory and optional key of the instance.
 * @returns The paths of the instance files.
 */
export function devInstancePaths(identity: DevInstanceIdentity): DevInstancePaths {
  const folder = joinPath(identity.directory, '.shopify', DEV_INSTANCES_FOLDER)
  const slug = devInstanceSlug(identity)
  return {
    folder,
    infoFile: joinPath(folder, `${slug}.json`),
    lockFile: joinPath(folder, `${slug}.lock`),
    logFile: joinPath(folder, `${slug}.jsonl`),
  }
}

/**
 * Marks this process as the running instance of a long-running command for a project.
 *
 * Mutual exclusion uses `proper-lockfile`: an atomic `mkdir` lock whose mtime this process refreshes as a heartbeat.
 * Startup and abandoned-lock recovery are serialized separately. A live owner blocks takeover, including when
 * its heartbeat is stale. A lock without an owner record can be recovered after 30 seconds.
 *
 * @param options - The instance identity, initial details.
 * @returns The acquired instance.
 * @throws AbortError with code {@link DEV_INSTANCE_ALREADY_RUNNING_CODE} when another live instance holds the lock.
 */
export async function acquireDevInstance(options: AcquireDevInstanceOptions): Promise<DevInstance> {
  const paths = devInstancePaths(options)
  await getOrCreateHiddenShopifyFolder(options.directory)
  await mkdir(paths.folder)
  try {
    return await withDevInstanceStartupLock(paths.lockFile, () => createDevInstance(options, paths))
  } catch (error) {
    if (!isLockedError(error)) throw error
    const existing = await readDevInstanceInfo(paths.infoFile)
    throw devInstanceAlreadyRunningError(options, existing && isProcessAlive(existing.pid) ? existing : undefined)
  }
}

async function createDevInstance(options: AcquireDevInstanceOptions, paths: DevInstancePaths): Promise<DevInstance> {
  const previous = await readDevInstanceInfo(paths.infoFile)
  if (previous && isProcessAlive(previous.pid)) throw devInstanceAlreadyRunningError(options, previous)
  const sessionId = randomUUID()
  const abortController = new AbortController()
  let compromised = false
  const ownsInfo = () => {
    if (compromised) return false
    try {
      return (JSON.parse(readFileSync(paths.infoFile, 'utf8')) as DevInstanceInfo).sessionId === sessionId
      // A missing or unreadable record does not authorize deleting another session's files.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      return false
    }
  }
  let published = false
  const removeOwnedLockSync = (path: fs.PathLike) => {
    if (published && !ownsInfo()) return
    try {
      fs.rmdirSync(path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  const lockOptions = {
    realpath: false,
    lockfilePath: paths.lockFile,
    stale: DEFAULT_STALE_MS,
    retries: 0,
    // The default handler throws asynchronously and would crash the long-running command.
    onCompromised: (error: Error) => {
      compromised = true
      outputDebug(`The ${options.command} instance lock was compromised: ${error.message}`)
      abortController.abort(
        new AbortError(`The ${options.command} instance lost its lock.`, 'Start the command again.'),
      )
    },
    fs: {
      ...fs,
      rmdir: (path: fs.PathLike, callback: fs.NoParamCallback) => {
        if (published && !ownsInfo()) return callback(null)
        // proper-lockfile requires the callback filesystem API.
        // eslint-disable-next-line n/prefer-promises/fs
        fs.rmdir(path, callback)
      },
      rmdirSync: removeOwnedLockSync,
    },
  }

  let releaseLock: () => Promise<void>
  try {
    releaseLock = await lockfile.lock(paths.infoFile, lockOptions)
  } catch (error) {
    if (!isLockedError(error)) throw error
    const existing = await readDevInstanceInfo(paths.infoFile)
    if (existing && isProcessAlive(existing.pid)) throw devInstanceAlreadyRunningError(options, existing)
    if (!existing && (await lockIsFresh(paths))) {
      // Another process holds the lock but hasn't described itself yet.
      throw devInstanceAlreadyRunningError(options, undefined)
    }
    outputDebug(`Taking over an abandoned ${options.command} instance lock at ${paths.lockFile}`)
    await rmdir(paths.lockFile, {force: true})
    releaseLock = await lockfile.lock(paths.infoFile, lockOptions).catch((retryError: unknown) => {
      if (isLockedError(retryError)) throw devInstanceAlreadyRunningError(options, undefined)
      throw retryError
    })
  }

  const now = formatJsonOutputTimestamp(new Date())
  const info: DevInstanceInfo = {
    schemaVersion: 1,
    sessionId,
    command: options.command,
    ...(options.key ? {key: options.key} : {}),
    pid: process.pid,
    status: 'starting',
    startedAt: now,
    updatedAt: now,
    directory: options.directory,
    logFile: paths.logFile,
    details: {...(options.details ?? {})},
  }

  // Each run starts a fresh log.
  const logStream: WriteStream = createWriteStream(paths.logFile, {flags: 'w', mode: 0o600})
  logStream.on('error', (error) => outputDebug(`Failed to write the ${options.command} log: ${error.message}`))

  let updates = Promise.resolve()
  const flushers = new Set<() => void>()
  let released = false
  const removeInfoOnExit = () => {
    // Remove the lock before the live owner's record, so a new starter cannot enter during cleanup.
    if (!released && ownsInfo()) {
      removeOwnedLockSync(paths.lockFile)
      removeFileSync(paths.infoFile)
    }
  }
  process.once('exit', removeInfoOnExit)

  const writeLogEntry = (entry: Omit<DevInstanceLogEntry, 'sessionId' | 'timestamp'>) => {
    if (released || compromised || logStream.destroyed) return
    const line: DevInstanceLogEntry = {
      sessionId: info.sessionId,
      timestamp: formatJsonOutputTimestamp(new Date()),
      ...entry,
    }
    logStream.write(`${JSON.stringify(line)}\n`)
  }

  const instance: DevInstance = {
    info,
    paths,
    abortSignal: abortController.signal,
    update: async (changes) => {
      if (released || compromised) return
      if (changes.status) info.status = changes.status
      if (changes.details) info.details = {...info.details, ...changes.details}
      info.updatedAt = formatJsonOutputTimestamp(new Date())
      const snapshot = {...info, details: {...info.details}}
      const write = updates.then(async () => {
        if (!compromised) await writeDevInstanceInfo(paths.infoFile, snapshot)
      })
      updates = write.catch(() => {})
      await write
    },
    log: writeLogEntry,
    tee: (target, {source, stream}) => {
      const decoder = new StringDecoder('utf8')
      let pending = ''
      const flushLines = (text: string) => {
        const lines = text.split(/\r?\n/)
        pending = lines.pop() ?? ''
        for (const line of lines) {
          const message = unstyled(line).trimEnd()
          if (message.length > 0) writeLogEntry({source, stream, message})
        }
      }
      const flush = () => flushLines(`${pending}${decoder.end()}\n`)
      flushers.add(flush)
      return new Writable({
        write(chunk: Buffer | string, encoding, callback) {
          target.write(chunk, encoding)
          flushLines(pending + (typeof chunk === 'string' ? chunk : decoder.write(chunk)))
          callback()
        },
        final(callback) {
          flush()
          flushers.delete(flush)
          callback()
        },
      })
    },
    release: async () => {
      if (released) return
      flushers.forEach((flush) => flush())
      released = true
      process.removeListener('exit', removeInfoOnExit)
      await updates.catch((error: Error) => outputDebug(`Failed to save dev status: ${error.message}`))
      await new Promise<void>((resolve) => logStream.end(resolve))
      const owned = ownsInfo()
      await releaseLock().catch((error: Error) =>
        outputDebug(`Failed to release the dev instance lock: ${error.message}`),
      )
      if (owned) await removeFile(paths.infoFile).catch(() => {})
    },
  }

  await writeDevInstanceInfo(paths.infoFile, info)
  published = true
  return instance
}

/**
 * Returns the running instance of a command for a project, if there is one.
 *
 * @param identity - The command, directory and optional key of the instance.
 * @returns The instance description, or undefined when no live instance holds the lock.
 */
export async function readDevInstance(identity: DevInstanceIdentity): Promise<DevInstanceInfo | undefined> {
  const paths = devInstancePaths(identity)
  return readLiveDevInstance(paths)
}

/**
 * Lists every running dev instance of a project, across commands and keys.
 *
 * @param directory - The project directory.
 * @returns The descriptions of the live instances.
 */
export async function listDevInstances(directory: string): Promise<DevInstanceInfo[]> {
  const folder = joinPath(directory, '.shopify', DEV_INSTANCES_FOLDER)
  if (!(await fileExists(folder))) return []
  const infoFiles = await glob('*.json', {cwd: folder, absolute: true, onlyFiles: true})
  const instances = await Promise.all(
    infoFiles.map((infoFile) =>
      readLiveDevInstance({
        folder,
        infoFile,
        lockFile: infoFile.replace(/\.json$/, '.lock'),
        logFile: infoFile.replace(/\.json$/, '.jsonl'),
      }),
    ),
  )
  return instances.filter((instance): instance is DevInstanceInfo => instance !== undefined)
}

async function readLiveDevInstance(paths: DevInstancePaths): Promise<DevInstanceInfo | undefined> {
  const info = await readDevInstanceInfo(paths.infoFile)
  if (!info || !isProcessAlive(info.pid)) return undefined
  if (!(await lockIsFresh(paths))) return undefined
  return info
}

async function lockIsFresh(paths: DevInstancePaths): Promise<boolean> {
  try {
    return await lockfile.check(paths.infoFile, {
      realpath: false,
      lockfilePath: paths.lockFile,
      stale: DEFAULT_STALE_MS,
    })
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

async function readDevInstanceInfo(infoFile: string): Promise<DevInstanceInfo | undefined> {
  try {
    const parsed = JSON.parse(await readFile(infoFile)) as DevInstanceInfo
    return typeof parsed?.pid === 'number' ? parsed : undefined
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

async function writeDevInstanceInfo(infoFile: string, info: DevInstanceInfo): Promise<void> {
  // Write then rename so readers never see a partial file. Details may hold local URLs with keys, so keep it private.
  const temporaryFile = `${infoFile}.${info.sessionId}.tmp`
  await writeFileWithMode(temporaryFile, `${JSON.stringify(info, null, 2)}\n`, {mode: 0o600})
  await renameFile(temporaryFile, infoFile)
}

function isLockedError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ELOCKED'
}

function devInstanceSlug({command, key}: DevInstanceIdentity): string {
  return [command, key]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function devInstanceAlreadyRunningError(
  identity: DevInstanceIdentity,
  existing: DevInstanceInfo | undefined,
): AbortError {
  const command = `shopify ${identity.command}`
  if (!existing) {
    const error = new AbortError(
      `Another \`${command}\` is starting for this project.`,
      'Wait a few seconds and try again, or stop the other process first.',
    )
    error.code = DEV_INSTANCE_ALREADY_RUNNING_CODE
    return error
  }

  const stopCommand = process.platform === 'win32' ? `taskkill /PID ${existing.pid} /F` : `kill ${existing.pid}`
  const detailLines = Object.entries(existing.details)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    .map(([name, value]) => [name, String(value)])

  const error = new AbortError(
    `Another \`${command}\` is already running for this project.`,
    'Use the running instance, or stop it before starting a new one.',
    [
      ['Read its output in', {filePath: existing.logFile}],
      ['Stop it with', {command: stopCommand}],
    ],
    [
      {
        body: {
          tabularData: [['PID', String(existing.pid)], ['Started', existing.startedAt], ...detailLines],
          firstColumnSubdued: true,
        },
      },
    ],
  )
  error.code = DEV_INSTANCE_ALREADY_RUNNING_CODE
  error.details = {instance: existing}
  return error
}
