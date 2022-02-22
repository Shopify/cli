import type {Writable} from 'node:stream'
import {execa} from 'execa'

export interface ExecOptions {
  cwd?: string
  stdout?: Writable
  stderr?: Writable
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
