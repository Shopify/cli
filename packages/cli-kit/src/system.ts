import {concurrent as concurrentOutput, shouldDisplayColors, debug} from './output'
import {Abort} from './error'
import {execa, ExecaChildProcess} from 'execa'
import {AbortSignal} from 'abort-controller'
import type {Writable} from 'node:stream'

export interface ExecOptions {
  cwd?: string
  env?: {[key: string]: string | undefined}
  stdout?: Writable | 'inherit'
  stderr?: Writable
  stdin?: string
  signal?: AbortSignal
}

export const open = async (url: string) => {
  const externalOpen = await import('open')
  await externalOpen.default(url)
}

/**
 * Runs a command asynchronously, aggregates the stdout data, and returns it.
 * @param command {string} Command to be executed.
 * @param args {string[]} Arguments to pass to the command.
 * @returns A promise that resolves with the aggregatted stdout of the command.
 */
export const captureOutput = async (command: string, args: string[], options?: ExecOptions): Promise<string> => {
  const result = await buildExec(command, args, options)
  return result.stdout
}

export const exec = async (command: string, args: string[], options?: ExecOptions) => {
  const commandProcess = buildExec(command, args, options)
  if (options?.stderr) {
    commandProcess.stderr?.pipe(options.stderr)
  }
  if (options?.stdout && options.stdout !== 'inherit') {
    commandProcess.stdout?.pipe(options.stdout)
  }
  options?.signal?.addEventListener('abort', () => {
    commandProcess.kill('SIGTERM', {forceKillAfterTimeout: 1000})
  })
  try {
    await commandProcess
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (processError: any) {
    const abortError = new Abort(processError.message)
    abortError.stack = processError.stack
    throw abortError
  }
}

const buildExec = (command: string, args: string[], options?: ExecOptions): ExecaChildProcess<string> => {
  const env = options?.env ?? process.env
  if (shouldDisplayColors()) {
    env.FORCE_COLOR = '1'
  }
  const commandProcess = execa(command, args, {
    env,
    cwd: options?.cwd,
    input: options?.stdin,
    stdout: options?.stdout === 'inherit' ? 'inherit' : undefined,
  })
  debug(`
Running system process:
  · Command: ${command} ${args.join(' ')}
  · Working directory: ${options?.cwd ?? process.cwd()}
`)
  return commandProcess
}

interface ConcurrentExecCommand {
  prefix: string
  executable: string
  args: string[]
  cwd: string
}

/**
 * Runs commands concurrently and combines the standard output and error data
 * into a single stream that differenciates the sources using a colored prefix:
 *
 * Example:
 *   [my-extension] Log coming from my-extension
 *   [my-script] Log coming from my script
 *
 * If one of the processes fails, it aborts the running ones and exits with that error.
 * @param commands {ConcurrentExecCommand[]} Commands to execute.
 */
export const concurrentExec = async (commands: ConcurrentExecCommand[]): Promise<void> => {
  await concurrentOutput(
    commands.map((command) => {
      return {
        prefix: command.prefix,
        action: async (stdout, stderr, signal) => {
          await exec(command.executable, command.args, {
            stdout,
            stderr,
            cwd: command.cwd,
            signal,
          })
        },
      }
    }),
  )
}
