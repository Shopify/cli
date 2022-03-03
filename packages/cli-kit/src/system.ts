import type {Writable} from 'node:stream'
import {execa} from 'execa'

export {default as open} from 'open'

export interface ExecOptions {
  cwd?: string
  stdout?: Writable
  stderr?: Writable
}

/**
 * Runs a command asynchronously, aggregates the stdout data, and returns it.
 * @param command {string} Command to be executed.
 * @param args {string[]} Arguments to pass to the command.
 * @returns A promise that resolves with the aggregatted stdout of the command.
 */
export const captureOutput = async (
  command: string,
  args: string[],
): Promise<string> => {
  const result = await execa(command, args)
  return result.stdout
}

export const exec = async (
  command: string,
  args: string[],
  options?: ExecOptions,
) => {
  const commandProcess = execa(command, args, {
    cwd: options?.cwd,
  })
  if (options?.stderr) {
    commandProcess.stderr?.pipe(options.stderr)
  }
  if (options?.stdout) {
    commandProcess.stdout?.pipe(options.stdout)
  }
  await commandProcess
}
