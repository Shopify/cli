import {path, system, yaml} from '@shopify/cli-kit'
import {Writable} from 'node:stream'
import {App, Extension} from '$cli/models/app/app'

interface HomeOptions {
  stdout: Writable
  stderr: Writable
  app: App
}

export default async function extension(extension: Extension, {stdout, stderr, app}: HomeOptions): Promise<void> {
  stdout.write('Starting the extension build')
  const binaryDir = await system.captureOutput('/opt/dev/bin/dev', ['project-path', 'shopify-cli-extensions'])
  const extensionRelativePath = path.relative(app.directory, extension.directory)
  const envConfigs = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    root_dir: '.',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    build_dir: path.join(extensionRelativePath, 'build/development'),
    entries: {
      main: path.join(extensionRelativePath, 'src/index.js'),
    },
  }
  const yamlConfigs = yaml.encode({
    extensions: [
      {
        title: extension.configuration.name,
        type: 'checkout_post_purchase',
        metafields: [],
        development: envConfigs,
      },
    ],
  })
  stdout.write(yamlConfigs)
  await system.exec(path.join(binaryDir, 'shopify-cli-extensions'), ['build', '-'], {
    cwd: app.directory,
    stdout,
    stderr,
    stdin: yamlConfigs,
  })
}
