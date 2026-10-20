import {getOrCreateHiddenShopifyFolder} from './hidden-folder.js'
import {joinPath} from './path.js'
import {fileExists, glob, mkdir, readFile, removeFile, removeFileSync, renameFile, rmdir} from './fs.js'
import {AbortError} from './error.js'
import {outputDebug, unstyled} from './output.js'
import {formatJsonOutputTimestamp} from './json-output-schema.js'
import {randomUUID} from './crypto.js'
import {
  ConcurrentOutputContext,
  getConcurrentOutputContext,
  useConcurrentOutputContext,
} from '../../private/node/ui/components/ConcurrentOutput.js'
import lockfile from 'proper-lockfile'
import fs, {createWriteStream, readFileSync, type WriteStream} from 'fs'
import {mkdir as mkdirExclusive, rmdir as removeEmptyDirectory, writeFile as writeFileWithMode} from 'fs/promises'
import {Writable, type WritableOptions} from 'stream'
import {finished} from 'stream/promises'
import {StringDecoder} from 'string_decoder'
import {once} from 'events'

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
  /** Receives each entry after it is written to the session log. */
  onLog?: (entry: DevInstanceLogEntry) => void
}

export interface DevInstanceUpdate {
  status?: DevInstanceInfo['status']
  /** Merged into the existing details. */
  details?: {[key: string]: unknown}
}

export interface DevInstance {
  readonly info: DevInstanceInfo
  readonly paths: DevInstancePaths
  /** Aborts when this session loses its lock or output fails. Consumers must stop their owned work. */
  readonly abortSignal: AbortSignal
  /** Updates and persists the instance description. */
  update: (changes: DevInstanceUpdate) => Promise<void>
  /** Appends one entry to the JSON Lines log. */
  log: (entry: Omit<DevInstanceLogEntry, 'timestamp'>) => Promise<void>
  /**
   * Wraps a stream so every line written to it is also appended to the log, without ANSI styling.
   * The returned stream forwards the original bytes to `target` unchanged.
   */
  tee: (
    target: Writable,
    options: {
      source: string
      stream: 'stdout' | 'stderr'
      /** Treat each string write as a complete message. Byte writes remain buffered into lines. */
      stringWritesAreMessages?: boolean
    },
  ) => Writable
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
 * An exclusive startup directory serializes abandoned-lock recovery. An interrupted startup requires explicit
 * cleanup of that directory. A live owner blocks takeover, including when its heartbeat is stale.
 *
 * @param options - The instance identity, initial details.
 * @returns The acquired instance.
 * @throws AbortError with code {@link DEV_INSTANCE_ALREADY_RUNNING_CODE} when another live instance holds the lock.
 */
export async function acquireDevInstance(options: AcquireDevInstanceOptions): Promise<DevInstance> {
  const paths = devInstancePaths(options)
  await getOrCreateHiddenShopifyFolder(options.directory)
  await mkdir(paths.folder)
  const startupLock = `${paths.lockFile}.acquire`
  try {
    await mkdirExclusive(startupLock, {mode: 0o700})
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const startupError = new AbortError(
      `Another \`shopify ${options.command}\` is starting, or a previous startup was interrupted.`,
      'Wait for other starts to finish. If none is running, remove the startup lock below and try again.',
      [['Startup lock', {filePath: startupLock}]],
    )
    startupError.code = DEV_INSTANCE_ALREADY_RUNNING_CODE
    throw startupError
  }
  try {
    return await createDevInstance(options, paths)
  } catch (error) {
    if (!isLockedError(error)) throw error
    const existing = await readDevInstanceInfo(paths.infoFile)
    throw devInstanceAlreadyRunningError(options, existing && isProcessAlive(existing.pid) ? existing : undefined)
  } finally {
    await removeEmptyDirectory(startupLock)
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

  if (previous) await rmdir(paths.lockFile, {force: true})
  const releaseLock = await lockfile.lock(paths.infoFile, lockOptions)

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
  logStream.on('error', (error) => abortController.abort(error))

  let updates = Promise.resolve()
  const outputs = new Set<Writable>()
  let released = false
  let releasePromise: Promise<void> | undefined
  const removeInfoOnExit = () => {
    // Remove the lock before the live owner's record, so a new starter cannot enter during cleanup.
    if (!released && ownsInfo()) {
      removeOwnedLockSync(paths.lockFile)
      removeFileSync(paths.infoFile)
    }
  }
  process.once('exit', removeInfoOnExit)

  const writeLogEntry = async (entry: Omit<DevInstanceLogEntry, 'timestamp'>) => {
    if (released || compromised) return
    const line: DevInstanceLogEntry = {
      timestamp: formatJsonOutputTimestamp(new Date()),
      ...entry,
    }
    await writeToStream(logStream, `${JSON.stringify(line)}\n`)
    options.onLog?.(line)
  }

  const instance: DevInstance = {
    info,
    paths,
    abortSignal: abortController.signal,
    update: async (changes) => {
      if (releasePromise || compromised) return
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
    tee: (target, {source, stream, stringWritesAreMessages = false}) => {
      const decoder = new StringDecoder('utf8')
      let pending = ''
      let currentSource = source
      const flushLines = async (text: string) => {
        const lines = text.split(/\r?\n/)
        pending = lines.pop() ?? ''
        await Promise.all(
          lines.map(async (line) => {
            const message = unstyled(line).trimEnd()
            if (message.length > 0) await writeLogEntry({source: currentSource, stream, message})
          }),
        )
      }
      const flush = () => flushLines(`${pending}${decoder.end()}\n`)
      const output = new DevInstanceOutput({
        decodeStrings: !stringWritesAreMessages,
        write(chunk: Buffer | string, encoding, callback) {
          const nextSource = getConcurrentOutputContext()?.outputPrefix ?? source
          const completeMessage = stringWritesAreMessages && typeof chunk === 'string'
          const previous = nextSource !== currentSource || completeMessage ? flush() : Promise.resolve()
          currentSource = nextSource
          Promise.all([
            previous,
            writeToStream(target, chunk, encoding),
            flushLines(
              pending + (typeof chunk === 'string' ? chunk : decoder.write(chunk)) + (completeMessage ? '\n' : ''),
            ),
          ])
            .then(() => callback())
            .catch(callback)
        },
        final(callback) {
          flush()
            .then(() => callback())
            .catch(callback)
        },
      })
      const onTargetError = (error: Error) => output.destroy(error)
      target.on('error', onTargetError)
      output.on('error', (error) => abortController.abort(error))
      output.once('close', () => {
        target.off('error', onTargetError)
      })
      outputs.add(output)
      return output
    },
    release: () => {
      releasePromise ??= (async () => {
        try {
          const results = await Promise.allSettled([...outputs].map((output) => endStream(output)))
          const failure = results.find((result) => result.status === 'rejected')
          if (failure?.status === 'rejected') throw failure.reason
          await updates
        } finally {
          released = true
          process.removeListener('exit', removeInfoOnExit)
          try {
            await endStream(logStream)
          } finally {
            const owned = ownsInfo()
            await releaseLock().catch((error: Error) =>
              outputDebug(`Failed to release the dev instance lock: ${error.message}`),
            )
            if (owned) await removeFile(paths.infoFile).catch(() => {})
          }
        }
      })()
      return releasePromise
    },
  }

  try {
    await once(logStream, 'open')
    await writeDevInstanceInfo(paths.infoFile, info)
    published = true
    return instance
  } catch (error) {
    // Closing an already failed log can reject too; preserve the original setup error.
    await instance.release().catch((cleanupError: Error) => outputDebug(cleanupError.message))
    await removeFile(`${paths.infoFile}.${sessionId}.tmp`)
    throw error
  }
}

// Writable processes queued chunks in an earlier write's context. Capture context when each chunk is submitted.
class DevInstanceOutput extends Writable {
  private readonly contexts: (ConcurrentOutputContext | undefined)[] = []

  constructor(options: WritableOptions & {write: NonNullable<WritableOptions['write']>}) {
    super({
      ...options,
      write: (chunk, encoding, callback) => {
        useConcurrentOutputContext(this.contexts.shift() ?? {}, () =>
          options.write.call(this, chunk, encoding, callback),
        )
      },
    })
  }

  write(
    chunk: string | Uint8Array,
    encoding?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ): boolean {
    this.contexts.push(getConcurrentOutputContext())
    return typeof encoding === 'string' ? super.write(chunk, encoding, callback) : super.write(chunk, encoding)
  }

  end(
    chunk?: string | Uint8Array | null | (() => void),
    encoding?: BufferEncoding | (() => void),
    callback?: () => void,
  ): this {
    if (chunk !== undefined && chunk !== null && typeof chunk !== 'function')
      this.contexts.push(getConcurrentOutputContext())
    if (typeof chunk === 'function') return super.end(chunk)
    return typeof encoding === 'string' ? super.end(chunk, encoding, callback) : super.end(chunk, encoding)
  }
}

async function writeToStream(stream: Writable, chunk: Buffer | string, encoding: BufferEncoding = 'utf8') {
  await new Promise<void>((resolve, reject) => {
    stream.write(chunk, encoding, (error) => (error ? reject(error) : resolve()))
  })
}

async function endStream(stream: Writable) {
  const completed = finished(stream, {cleanup: true})
  stream.end()
  await completed
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
