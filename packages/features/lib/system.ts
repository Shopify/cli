import {isDebug} from './environment.js'
import colors from 'ansi-colors'
import {ExecaChildProcess, execa} from 'execa'

export interface ExecOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
}

/**
 * It provides a promise-based interface for running system processes.
 * The implementation forwards the standard
 * output and error if the variable DEBUG=1 is set when running acceptance
 * tests.
 * @param command - The command to be executed.
 * @returns A promise that resolves or rejects when the command execution finishes.
 */
export function exec(command: string, args: string[] = [], options?: ExecOptions): ExecaChildProcess {
  if (isDebug) {
    console.log(colors.gray(`Running: ${command} ${args.join(' ')}`))
  }

  const _options = {
    ...options,
    stdout: undefined,
    stderr: undefined,
    env: {...process.env, ...(options?.env ?? {}), SHOPIFY_RUN_AS_USER: '0'},
  }
  const shortCommand = command.split('/').slice(-1).pop() || ''
  const commandProcess = execa(command, args, _options)
  commandProcess.stdout?.on('data', (data: string) => {
    if (isDebug) {
      console.log(colors.gray(`${colors.bold(shortCommand)}: ${data}`))
    }
  })
  commandProcess.stderr?.on('data', (data: string) => {
    if (isDebug) {
      console.log(colors.gray(`${colors.bold(shortCommand)}: ${data}`))
    }
  })
  return commandProcess
}
