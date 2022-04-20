import {runGoExtensionsCLI, nodeExtensionsCLIPath} from '../../utilities/extensions/cli'
import {path, system, yaml} from '@shopify/cli-kit'
import {Writable} from 'node:stream'
import {App, Extension} from '$cli/models/app/app'

interface HomeOptions {
  stdout: Writable
  stderr: Writable
  app: App
  signal: AbortSignal
}

export default async function extension(extension: Extension, {stdout, stderr, app}: HomeOptions): Promise<void> {
  stdout.write(`Building extension...`)
  const stdin = yaml.encode(await extensionConfig(extension))
  await runGoExtensionsCLI(['build', '-'], {
    cwd: extension.directory,
    stdout,
    stderr,
    stdin,
  })
}

async function extensionConfig(extension: Extension): Promise<any> {
  return {
    extensions: [
      {
        title: extension.configuration.name,
        type: extension.configuration.type,
        metafields: extension.configuration.metafields,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        node_executable: await nodeExtensionsCLIPath(),
        development: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          root_dir: ".",
          // eslint-disable-next-line @typescript-eslint/naming-convention
          build_dir: path.relative(extension.directory, extension.buildDirectory),
          entries: {
            main: path.relative(extension.directory, extension.entrySourceFilePath),
          },
        },
      },
    ],
  }
}

async function extensionsBinaryPath(): Promise<string> {
  const binaryDir = await system.captureOutput('/opt/dev/bin/dev', ['project-path', 'shopify-cli-extensions'])
  return path.join(binaryDir, 'shopify-extensions')
}
