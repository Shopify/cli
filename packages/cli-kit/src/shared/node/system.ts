import {AbortSignal} from './abort.js'
import {AbortError, ExternalError} from './error.js'
import {cwd, dirname} from './path.js'
import {treeKill} from './tree-kill.js'
import {isTruthy} from './context/utilities.js'
import {renderWarning} from './ui.js'
import {platformAndArch} from './os.js'
import {shouldDisplayColors, outputDebug} from './output.js'
import {execa, execaCommand, ExecaChildProcess} from 'execa'
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
 * Options passed directly to execa.
 */
interface BuildExecOptions {
  /** Whether to throw on non-zero exit codes (default: true). */
  reject?: boolean
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
 * Result from running a command with captureOutputWithExitCode.
 */
export interface CaptureOutputResult {
  /** Standard output. */
  stdout: string
  /** Standard error. */
  stderr: string
  /** Exit code (0 = success). */
  exitCode: number
}

/**
 * Runs a command asynchronously and returns stdout, stderr, and exit code.
 * Unlike captureOutput, this function does NOT throw on non-zero exit codes.
 *
 * @param command - Command to be executed.
 * @param args - Arguments to pass to the command.
 * @param options - Optional settings for how to run the command.
 * @returns A promise that resolves with stdout, stderr, and exitCode.
 *
 * @example
 * ```typescript
 * const result = await captureOutputWithExitCode('ls', ['-la'])
 * if (result.exitCode !== 0) \{
 *   console.error('Command failed:', result.stderr)
 * \}
 * ```
 */
export async function captureOutputWithExitCode(
  command: string,
  args: string[],
  options?: ExecOptions,
): Promise<CaptureOutputResult> {
  const result = await buildExec(command, args, options, {reject: false})
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode ?? 0,
  }
}

/**
 * Parse a command string into an array of arguments, respecting quoted strings.
 * Handles both single and double quotes, preserving spaces within quoted sections.
 *
 * @param command - The command string to parse (e.g., 'ls -la "my folder"').
 * @returns An array of command parts with quotes removed.
 *
 * @example
 * parseCommand('shopify theme push --theme "My Theme Name"') // ['shopify', 'theme', 'push', '--theme', 'My Theme Name']
 */
function parseCommand(command: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuote: string | null = null

  for (const char of command) {
    if (inQuote) {
      if (char === inQuote) {
        // End of quoted section
        inQuote = null
      } else {
        current += char
      }
    } else if (char === '"' || char === "'") {
      // Start of quoted section
      inQuote = char
    } else if (char === ' ' || char === '\t') {
      // Whitespace outside quotes - end current token
      if (current) {
        result.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  // Don't forget the last token
  if (current) {
    result.push(current)
  }

  return result
}

/**
 * Runs a command string asynchronously and returns stdout, stderr, and exit code.
 * Parses the command string into command and arguments (handles quoted strings).
 * Unlike captureOutput, this function does NOT throw on non-zero exit codes.
 *
 * @param command - Full command string to be executed (e.g., 'ls -la "my folder"').
 * @param options - Optional settings for how to run the command.
 * @returns A promise that resolves with stdout, stderr, and exitCode.
 *
 * @example
 * ```typescript
 * const result = await captureCommandWithExitCode('shopify theme push --theme "My Theme"')
 * if (result.exitCode !== 0) {
 *   console.error('Command failed:', result.stderr)
 * }
 * ```
 */
export async function captureCommandWithExitCode(command: string, options?: ExecOptions): Promise<CaptureOutputResult> {
  const env = options?.env ?? process.env
  if (shouldDisplayColors()) {
    env.FORCE_COLOR = '1'
  }
  const executionCwd = options?.cwd ?? cwd()
  const [cmd, ...args] = parseCommand(command)
  if (!cmd) {
    return {stdout: '', stderr: 'Empty command', exitCode: 1}
  }
  checkCommandSafety(cmd, {cwd: executionCwd})
  const result = await execa(cmd, args, {
    env,
    cwd: executionCwd,
    reject: false,
  })
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode ?? 0,
  }
}

/**
 * Runs a command string asynchronously (parses command and arguments from the string).
 *
 * @param command - Full command string to be executed (e.g., 'ls -la "my folder"').
 * @param options - Optional settings for how to run the command.
 */
export async function execCommand(command: string, options?: ExecOptions): Promise<void> {
  const env = options?.env ?? process.env
  if (shouldDisplayColors()) {
    env.FORCE_COLOR = '1'
  }
  const executionCwd = options?.cwd ?? cwd()
  try {
    await execaCommand(command, {
      env,
      cwd: executionCwd,
      stdin: options?.stdin,
      stdout: options?.stdout === 'inherit' ? 'inherit' : undefined,
      stderr: options?.stderr === 'inherit' ? 'inherit' : undefined,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (processError: any) {
    if (options?.externalErrorHandler) {
      await options.externalErrorHandler(processError)
    } else {
      const abortError = new ExternalError(processError.message, command, [])
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
    commandProcess.stderr?.pipe(options.stderr, {end: false})
  }
  if (options?.stdout && options.stdout !== 'inherit') {
    commandProcess.stdout?.pipe(options.stdout, {end: false})
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
 * @param execaOptions - Options passed directly to execa.
 * @returns A promise for a result with stdout and stderr properties.
 */
function buildExec(
  command: string,
  args: string[],
  options?: ExecOptions,
  execaOptions?: BuildExecOptions,
): ExecaChildProcess {
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
    ...execaOptions,
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
