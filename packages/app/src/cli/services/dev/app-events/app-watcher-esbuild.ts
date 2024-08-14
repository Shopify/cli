import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {getESBuildOptions} from '../../extensions/bundle.js'
import {BuildContext, BuildOptions, context as esContext} from 'esbuild'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {Writable} from 'stream'

interface DevAppWatcherOptions {
  extensions: ExtensionInstance[]
  dotEnvVariables: {[key: string]: string}
  url: string
  outputPath: string
  stderr: Writable
  stdout: Writable
  signal: AbortSignal
}

export async function createESBuildContextsForExtensions(options: DevAppWatcherOptions) {
  const contexts: {[key: string]: BuildContext<BuildOptions>} = {}

  const promises = options.extensions.map(async (extension) => {
    const esbuildOptions = getESBuildOptions({
      minify: false,
      outputPath: extension.getOutputPathForDirectory(options.outputPath),
      environment: 'development',
      env: {
        ...options.dotEnvVariables,
        APP_URL: options.url,
      },
      stdin: {
        contents: extension.getBundleExtensionStdinContent(),
        resolveDir: extension.directory,
        loader: 'tsx',
      },
      stderr: options.stderr,
      stdout: options.stdout,
      watchSignal: options.signal,
      sourceMaps: true,
    })

    const context = await esContext(esbuildOptions)
    contexts[extension.handle] = context
  })

  await Promise.all(promises)
  return contexts
}
