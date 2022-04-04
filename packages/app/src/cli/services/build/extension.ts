import {path, system} from '@shopify/cli-kit'
import {Writable} from 'node:stream'
import {Extension} from '$cli/models/app/app'

interface HomeOptions {
  stdout: Writable
  stderr: Writable
}

export default async function extension(extension: Extension, {stdout, stderr}: HomeOptions): Promise<void> {
  const esbuildPath = (await path.findUp('node_modules/.bin/esbuild', {type: 'file'})) as string
  stdout.write('Starting the extension build')
  await system.exec(
    esbuildPath,
    [`--outdir=${extension.buildDirectory}`, `--log-level=verbose`, path.join(extension.directory, 'index.jsx')],
    {
      stdout,
      stderr,
    },
  )
}
