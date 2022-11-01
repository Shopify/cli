import {shouldDisplayColors, debug} from './output.js'
import {platformAndArch} from './os.js'
import {ExternalError} from './error.js'
import {renderConcurrent} from './public/node/ui.js'
import {execa, ExecaChildProcess} from 'execa'
import {AbortSignal} from 'abort-controller'
import type {Writable, Readable} from 'node:stream'

export interface ExecOptions {
  cwd?: string
  env?: {[key: string]: string | undefined}
  stdin?: Readable | 'inherit'
  stdout?: Writable | 'inherit'
  stderr?: Writable | 'inherit'
  stdio?: 'inherit'
  input?: string
  signal?: AbortSignal
}
export type WritableExecOptions = Omit<ExecOptions, 'stdout'> & {stdout?: Writable}

export const open = async (url: string) => {
  const externalOpen = await import('open')
  await externalOpen.default(url)
}

/**
 * Runs a command asynchronously, aggregates the stdout data, and returns it.
 * @param command - Command to be executed.
 * @param args - Arguments to pass to the command.
 * @returns A promise that resolves with the aggregatted stdout of the command.
 */
export const captureOutput = async (command: string, args: string[], options?: ExecOptions): Promise<string> => {
  const result = await buildExec(command, args, options)
  return result.stdout
}

export const exec = async (command: string, args: string[], options?: ExecOptions) => {
  const commandProcess = buildExec(command, args, options)
  if (options?.stderr && options.stderr !== 'inherit') {
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
    const abortError = new ExternalError(processError.message, command, args)
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
    input: options?.input,
    stdio: options?.stdio,
    stdin: options?.stdin,
    stdout: options?.stdout === 'inherit' ? 'inherit' : undefined,
    stderr: options?.stderr === 'inherit' ? 'inherit' : undefined,
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
 * into a single stream. See {@link renderConcurrent} for more information about
 * the output format.
 *
 * If one of the processes fails, it aborts the running ones and exits with that error.
 * @param commands - Commands to execute.
 */
export const concurrentExec = async (commands: ConcurrentExecCommand[]): Promise<void> => {
  await renderConcurrent({
    processes: commands.map((command) => {
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
  })
}

/**
 * Displays a large file using the terminal pager set by the user, or a
 * reasonable default for the user's OS:
 *
 * @param filename - The path to the file to be displayed.
 */
export async function page(filename: string) {
  let executable: string
  if (process.env.PAGER) {
    executable = process.env.PAGER
  } else if ((await platformAndArch()).platform === 'windows') {
    executable = 'more'
  } else {
    executable = 'less -NR'
  }
  const [command, ...args] = [...executable.split(' '), filename]
  await exec(command, args, {stdout: 'inherit', stdin: 'inherit'})
}

export async function sleep(seconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, 1000 * seconds)
  })
}
