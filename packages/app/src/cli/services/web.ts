import {Web, WebConfigurationCommands} from '../models/app/app.js'
import {system} from '@shopify/cli-kit'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {Writable} from 'stream'

interface WebOptions {
  web: Web
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
  env?: {[variable: string]: string}
}

export default async function web(
  command: WebConfigurationCommands,
  {web, stdout, stderr, signal, env = {}}: WebOptions,
): Promise<void> {
  const script = web.configuration.commands[command]
  if (!script) {
    return
  }

  const [cmd, ...args] = script.split(' ')
  await system.exec(cmd!, args, {cwd: web.directory, stdout, stderr, signal, env})
  stdout.write('Web successfully built.')
}
