import {AbortSignal} from './abort.js'
import {AbortError, ExternalError} from './error.js'
import {cwd, dirname} from './path.js'
import {treeKill} from './tree-kill.js'
import {isTruthy} from './context/utilities.js'
import {renderWarning} from './ui.js'
import {shouldDisplayColors, outputDebug} from '../../public/node/output.js'
import {execa, ExecaChildProcess} from 'execa'
import which from 'which'
import {delimiter} from 'pathe'
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
}

/**
 * Opens a URL in the user's default browser.
 *
 * @param url - URL to open.
 */
export async function openURL(url: string): Promise<void> {
  const externalOpen = await import('open')
  await externalOpen.default(url)
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
  const commandProcess = buildExec(command, args, options)
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
    stdio: options?.stdio,
    stdin: options?.stdin,
    stdout: options?.stdout === 'inherit' ? 'inherit' : undefined,
    stderr: options?.stderr === 'inherit' ? 'inherit' : undefined,
    // Setting this to false makes it possible to kill the main process
    // and all its sub-processes with Ctrl+C on Windows
    windowsHide: false,
  })
  outputDebug(`
Running system process:
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
 * Check if the current environment is a browser.
 *
 * @returns True if the current environment is a browser.
 */
export function isBrowswer(): boolean {
  return typeof global !== 'undefined'
}
