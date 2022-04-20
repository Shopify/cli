import {concurrent as concurrentOutput} from './output'
import {execa} from 'execa'
import type {ExecaChildProcess} from 'execa'
import type {Writable} from 'node:stream'

export interface ExecOptions {
  cwd?: string
  env?: any
  stdout?: Writable
  stderr?: Writable
  stdin?: string
  signal?: AbortSignal
  colors?: boolean
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
export const captureOutput = async (command: string, args: string[]): Promise<string> => {
  const result = await execa(command, args)
  return result.stdout
}

export const exec = (command: string, args: string[], options?: ExecOptions): ExecaChildProcess<string> => {
  const env = options?.env ?? process.env
  if (options?.colors) {
    env.FORCE_COLOR = '1'
  }
  const commandProcess = execa(command, args, {
    env,
    cwd: options?.cwd,
    input: options?.stdin,
  })
  if (options?.stderr) {
    commandProcess.stderr?.pipe(options.stderr)
  }
  if (options?.stdout) {
    commandProcess.stdout?.pipe(options.stdout)
  }
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
  const abortController = new AbortController()
  try {
    await concurrentOutput(commands.map((command) => {
      return {
        prefix: command.prefix,
        action: async (stdout, stderr) => {
          await exec(command.executable, command.args, {
            stdout,
            stderr,
            cwd: command.cwd,
            signal: abortController.signal,
          })
        }
      }
    }))
  } catch (error: any) {
    // We abort any running process
    abortController.abort()
    throw error
  }
}
