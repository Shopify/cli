import {Web} from '../models/app/app'
import {system} from '@shopify/cli-kit'
import {WebConfigurationCommands} from 'cli/models/app/app'
import {Writable} from 'node:stream'

interface WebOptions {
  web: Web
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
}

export default async function web(
  command: WebConfigurationCommands,
  {web, stdout, stderr, signal}: WebOptions,
): Promise<void> {
  const script = web.configuration.commands[command]
  if (!script) {
    return
  }

  const [cmd, ...args] = script.split(' ')
  await system.exec(cmd, args, {cwd: web.directory, stdout, stderr, signal})
  stdout.write('Web successfully built.')
}
