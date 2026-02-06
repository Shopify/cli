import {AbortSignal} from './abort.js'
import {AbortError, ExternalError} from './error.js'
import {cwd, dirname} from './path.js'
import {treeKill} from './tree-kill.js'
import {isTruthy} from './context/utilities.js'
import {renderWarning} from './ui.js'
import {platformAndArch} from './os.js'
import {shouldDisplayColors, outputDebug} from '../../public/node/output.js'
import {execa, ExecaChildProcess} from 'execa'
import which from 'which'
import {delimiter} from 'pathe'
import {fstatSync} from 'fs'
import type {Writable, Readable} from 'stream'

export interface ExecOptions {
  cwd?: string
  env?: {[key: string]: string | undefined}
  stdin?: Readable | 'inherit'
  stdout?: Writable | 'inherit'
  stderr?: Writable | 'inherit'
  stdio?: 'inherit'
  input?: string
  signal?: AbortSignal
  // Custom handler if process exits with a non-zero code
  externalErrorHandler?: (error: unknown) => Promise<void>
  // Ignored on Windows
  background?: boolean
}

/**
 * Opens a URL in the user's default browser.
 *
 * @param url - URL to open.
 * @returns A promise that resolves true if the URL was opened successfully, false otherwise.
 */
export async function openURL(url: string): Promise<boolean> {
  const externalOpen = await import('open')
  try {
    await externalOpen.default(url)
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return false
  }
}

/**
 * Runs a command asynchronously, aggregates the stdout data, and returns it.
 *
 * @param command - Command to be executed.
 * @param args - Arguments to pass to the command.
 * @param options - Optional settings for how to run the command.
 * @returns A promise that resolves with the aggregatted stdout of the command.
 */
export async function captureOutput(command: string, args: string[], options?: ExecOptions): Promise<string> {
  const result = await buildExec(command, args, options)
  return result.stdout
}

/**
 * Runs a command asynchronously.
 *
 * @param command - Command to be executed.
 * @param args - Arguments to pass to the command.
 * @param options - Optional settings for how to run the command.
 */
export async function exec(command: string, args: string[], options?: ExecOptions): Promise<void> {
  if (options) {
    // Windows opens a new console window when running a command in the background, so we disable it.
    const runningOnWindows = platformAndArch().platform === 'windows'
    options.background = runningOnWindows ? false : options.background
  }

  const commandProcess = buildExec(command, args, options)

  if (options?.background) {
    commandProcess.unref()
  }

  if (options?.stderr && options.stderr !== 'inherit') {
    outputDebug(`[exec] Piping stderr for command: ${command}`)
    commandProcess.stderr?.pipe(options.stderr, {end: false})
    // Add debug listener to track data flow
    commandProcess.stderr?.on('data', (chunk) => {
      outputDebug(`[exec] stderr data received (${chunk.length} bytes) for: ${command}`)
    })
  }
  if (options?.stdout && options.stdout !== 'inherit') {
    outputDebug(`[exec] Piping stdout for command: ${command}`)
    commandProcess.stdout?.pipe(options.stdout, {end: false})
    // Add debug listener to track data flow
    commandProcess.stdout?.on('data', (chunk) => {
      outputDebug(`[exec] stdout data received (${chunk.length} bytes) for: ${command}`)
    })
  }
  let aborted = false
  options?.signal?.addEventListener('abort', () => {
    const pid = commandProcess.pid
    if (pid) {
      outputDebug(`Killing process ${pid}: ${command} ${args.join(' ')}`)
      aborted = true
      treeKill(pid, 'SIGTERM')
    }
  })
  try {
    await commandProcess
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (processError: any) {
    // Windows will throw an error whenever the process is killed, no matter the reason.
    // The aborted flag tell use that we killed it, so we can ignore the error.
    if (aborted) return
    if (options?.externalErrorHandler) {
      await options.externalErrorHandler(processError)
    } else {
      const abortError = new ExternalError(processError.message, command, args)
      abortError.stack = processError.stack
      throw abortError
    }
  }
}

/**
 * Runs a command asynchronously.
 *
 * @param command - Command to be executed.
 * @param args - Arguments to pass to the command.
 * @param options - Optional settings for how to run the command.
 * @returns A promise for a result with stdout and stderr properties.
 */
function buildExec(command: string, args: string[], options?: ExecOptions): ExecaChildProcess {
  const env = options?.env ?? process.env
  if (shouldDisplayColors()) {
    env.FORCE_COLOR = '1'
  }
  const executionCwd = options?.cwd ?? cwd()
  checkCommandSafety(command, {cwd: executionCwd})
  const commandProcess = execa(command, args, {
    env,
    cwd: executionCwd,
    input: options?.input,
    stdio: options?.background ? 'ignore' : options?.stdio,
    stdin: options?.stdin,
    stdout: options?.stdout === 'inherit' ? 'inherit' : undefined,
    stderr: options?.stderr === 'inherit' ? 'inherit' : undefined,
    // Setting this to false makes it possible to kill the main process
    // and all its sub-processes with Ctrl+C on Windows
    windowsHide: false,
    detached: options?.background,
    cleanup: !options?.background,
    // Disable buffering for stdout/stderr to ensure real-time streaming
    // This helps address output swallowing issues on Ubuntu 24.04 (#6726)
    buffer: false,
  })
  outputDebug(`Running system process${options?.background ? ' in background' : ''}:
  · Command: ${command} ${args.join(' ')}
  · Working directory: ${executionCwd}
`)
  return commandProcess
}

function checkCommandSafety(command: string, _options: {cwd: string}): void {
  const pathIncludingLocal = `${_options.cwd}${delimiter}${process.env.PATH}`
  const commandPath = which.sync(command, {
    nothrow: true,
    path: pathIncludingLocal,
  })
  if (commandPath && dirname(commandPath) === _options.cwd) {
    const headline = ['Skipped run of unsecure binary', {command}, 'found in the current directory.']
    const body = 'Please remove that file or review your current PATH.'
    renderWarning({headline, body})
    throw new AbortError(headline, body)
  }
}

/**
 * Waits for a given number of seconds.
 *
 * @param seconds - Number of seconds to wait.
 * @returns A Promise resolving after the number of seconds.
 */
export async function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 1000 * seconds)
  })
}

/**
 * Check if the standard input and output streams support prompting.
 *
 * @returns True if the standard input and output streams support prompting.
 */
export function terminalSupportsPrompting(): boolean {
  if (isTruthy(process.env.CI)) {
    return false
  }
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

/**
 * Check if the current environment is a CI environment.
 *
 * @returns True if the current environment is a CI environment.
 */
export function isCI(): boolean {
  return isTruthy(process.env.CI)
}

/**
 * Check if the current environment is a WSL environment.
 *
 * @returns True if the current environment is a WSL environment.
 */
export async function isWsl(): Promise<boolean> {
  const wsl = await import('is-wsl')
  return wsl.default
}

/**
 * Check if stdin has piped data available.
 * This distinguishes between actual piped input (e.g., `echo "query" | cmd`)
 * and non-TTY environments without input (e.g., CI).
 *
 * @returns True if stdin is receiving piped data or file redirect, false otherwise.
 */
export function isStdinPiped(): boolean {
  try {
    const stats = fstatSync(0)
    return stats.isFIFO() || stats.isFile()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

/**
 * Reads all data from stdin and returns it as a string.
 * This is useful for commands that accept input via piping.
 *
 * @example
 * // Usage: echo "your query" | shopify app execute
 * const query = await readStdin()
 *
 * @returns A promise that resolves with the stdin content, or undefined if stdin is a TTY.
 */
export async function readStdinString(): Promise<string | undefined> {
  if (!isStdinPiped()) {
    return undefined
  }

  let data = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) {
    data += String(chunk)
  }
  return data.trim()
}

/**
 * Get the WSL distribution name from the environment.
 * In WSL, the WSL_DISTRO_NAME environment variable contains the distribution name.
 *
 * @returns The WSL distribution name, or undefined if not in WSL or not available.
 */
export function getWslDistroName(): string | undefined {
  return process.env.WSL_DISTRO_NAME
}

/**
 * Convert a Unix path to a WSL-compatible file URL that can be opened from Windows.
 * In WSL, file paths need to be converted to the format: file://wsl.localhost/<distro>/path
 *
 * @param unixPath - The Unix-style path to convert (e.g., /tmp/file.html or /home/user/file.js)
 * @returns A file URL that works when opened from Windows in WSL environments.
 *
 * @example
 * // In WSL with Ubuntu distro:
 * // Input: /tmp/speedscope-123.html
 * // Output: file://wsl.localhost/Ubuntu/tmp/speedscope-123.html
 */
export async function convertToWslFileUrl(unixPath: string): Promise<string> {
  const inWsl = await isWsl()
  const distroName = getWslDistroName()

  if (inWsl && distroName) {
    // Convert to WSL localhost format for Windows to access
    return `file://wsl.localhost/${distroName}${unixPath}`
  }

  // Not in WSL, return standard file URL
  return `file://${unixPath}`
}
