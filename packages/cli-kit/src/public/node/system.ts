import {AbortSignal} from './abort.js'
import {ExternalError} from './error.js'
import {cwd} from './path.js'
import {treeKill} from './tree-kill.js'
import {shouldDisplayColors, outputDebug} from '../../public/node/output.js'
import {execa, ExecaChildProcess} from 'execa'
import {ReadStream} from 'tty'
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
      await options?.externalErrorHandler(processError)
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
function buildExec(command: string, args: string[], options?: ExecOptions): ExecaChildProcess<string> {
  const env = options?.env ?? process.env
  if (shouldDisplayColors()) {
    env.FORCE_COLOR = '1'
  }
  const commandProcess = execa(command, args, {
    env,
    cwd: options?.cwd,
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
  · Working directory: ${options?.cwd ?? cwd()}
`)
  return commandProcess
}

/**
 * Waits for a given number of seconds.
 *
 * @param seconds - Number of seconds to wait.
 */
export async function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 1000 * seconds)
  })
}

/**
 * In case an standard input stream is passed check if it supports raw mode. Otherwise default standard input stream
 * will be used.
 *
 * @param stdin - The standard input stream to check.
 * @returns True in the selected input stream support raw mode.
 */
export function terminalSupportsRawMode(stdin?: ReadStream): boolean {
  if (stdin) return Boolean(stdin.isTTY)
  return process.stdin.isTTY
}
