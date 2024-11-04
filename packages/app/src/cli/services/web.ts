import {Web, WebConfigurationCommands} from '../models/app/app.js'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {exec} from '@shopify/cli-kit/node/system'
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
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  await exec(cmd!, args, {cwd: web.directory, stdout, stderr, signal, env})
  stdout.write('Web successfully built.')
}
