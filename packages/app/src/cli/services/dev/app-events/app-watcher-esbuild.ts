import {OutputContextOptions} from './file-watcher.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {bundleExtension} from '../../extensions/bundle.js'
import {AppInterface} from '../../../models/app/app.js'
import {BuildOptions, BuildResult} from 'esbuild'

export async function startBundlerForESBuildExtensions(
  app: AppInterface,
  url: string,
  options: OutputContextOptions,
  onWatchChange: (result: BuildResult<BuildOptions> | null, extension: ExtensionInstance) => void,
) {
  const extensions = app.realExtensions.filter((extension) => extension.isESBuildExtension)
  const promises = extensions.map(async (extension) => {
    return bundleExtension({
      minify: false,
      outputPath: extension.outputPath,
      environment: 'development',
      env: {
        ...(app.dotenv?.variables ?? {}),
        APP_URL: url,
      },
      stdin: {
        contents: extension.getBundleExtensionStdinContent(),
        resolveDir: extension.directory,
        loader: 'tsx',
      },
      stderr: options.stderr,
      stdout: options.stdout,
      watchSignal: options.signal,
      watch: async (result) => onWatchChange(result, extension),
      //   const error = (result?.errors?.length ?? 0) > 0
      //   outputDebug(
      //     `The Javascript bundle of the UI extension with ID ${extension.devUUID} has ${
      //       error ? 'an error' : 'changed'
      //     }`,
      //     error ? options.devOptions.stderr : options.devOptions.stdout,
      //   )
      //   try {
      //     await options.payloadStore.updateExtension(extension, options.devOptions, {
      //       status: error ? 'error' : 'success',
      //     })
      //     // eslint-disable-next-line no-catch-all/no-catch-all
      //   } catch {
      //     // ESBuild handles error output
      //   }
      sourceMaps: true,
    })
  })

  await Promise.all(promises)
}
