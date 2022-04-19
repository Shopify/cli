import {path, system, yaml} from '@shopify/cli-kit'
import {Writable} from 'node:stream'
import {App, Extension} from '$cli/models/app/app'

interface HomeOptions {
  stdout: Writable
  stderr: Writable
  app: App
}

export default async function extension(extension: Extension, {stdout, stderr, app}: HomeOptions): Promise<void> {
  await system.exec(await extensionsBinaryPath(), ['build', '-'], {
    cwd: app.directory,
    stdout,
    stderr,
    stdin: yaml.encode(extensionConfig(extension, app)),
  })
}

function extensionConfig(extension: Extension, app: App): object {
  return {
    extensions: [
      {
        title: extension.configuration.name,
        type: extension.configuration.type,
        metafields: extension.configuration.metafields,
        commands: {
          build: 'shopify-cli-extensions build',
        },
        development: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          root_dir: '.',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          build_dir: path.relative(app.directory, extension.buildDirectory),
          entries: {
            main: path.relative(app.directory, extension.entrySourceFilePath),
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
