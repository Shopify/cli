import pc from 'picocolors'

import {isDebug} from './environment'

const execa = require('execa')

interface ExecOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
}

/**
 * It provides a promise-based interface for running system processes.
 * The implementation forwards the standard
 * output and error if the variable DEBUG=1 is set when running acceptance
 * tests.
 * @param command The command to be executed.
 * @returns A promise that resolves or rejects when the command execution finishes.
 */
export const exec = async (
  command: string,
  args: string[] = [],
  options?: ExecOptions,
) => {
  if (isDebug) {
    console.log(pc.gray(`Running: ${command} ${args.join(' ')}`))
  }

  const _options: any = {...options, stdout: undefined, stderr: undefined}
  const commandProcess = execa(command, args, _options)
  const shortCommand = command.split('/').slice(-1).pop()
  commandProcess.stdout.on('data', (data: string) => {
    if (isDebug) {
      console.log(pc.gray(`${pc.bold(shortCommand)}: ${data}`))
    }
  })
  commandProcess.stderr.on('data', (data: string) => {
    if (isDebug) {
      console.log(pc.gray(`${pc.bold(shortCommand)}: ${data}`))
    }
  })
  await commandProcess
}
