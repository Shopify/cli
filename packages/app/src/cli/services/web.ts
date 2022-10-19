import {Web, WebConfigurationCommands} from '../models/app/app.js'
import {system, abort} from '@shopify/cli-kit'
import {Writable} from 'node:stream'

interface WebOptions {
  web: Web
  stdout: Writable
  stderr: Writable
  signal: abort.Signal
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
