import {ExtensionsPayloadStore} from './payload/store.js'
import {ExtensionDevOptions} from '../extension.js'
import {bundleExtension} from '../../extensions/bundle.js'
import {abort, path, output} from '@shopify/cli-kit'
import chokidar from 'chokidar'

export interface WatchEvent {
  path: string
  type: 'build' | 'localization'
}

export interface FileWatcherOptions {
  devOptions: ExtensionDevOptions
  payloadStore: ExtensionsPayloadStore
}

export interface FileWatcher {
  close: () => void
}

export async function setupBundlerAndFileWatcher(options: FileWatcherOptions) {
  const abortController = new abort.Controller()

  const bundlers: Promise<void>[] = []

  options.devOptions.extensions.forEach((extension) => {
    const stdinContent = extension.entrySourceFilePaths
      .map((filePath) => `import './${path.relative(extension.directory, filePath)}';`)
      .join('\n')

    bundlers.push(
      bundleExtension({
        minify: false,
        outputBundlePath: extension.outputBundlePath,
        stdin: {
          contents: stdinContent,
          resolveDir: extension.directory,
          loader: 'tsx',
        },
        environment: 'development',
        env: {
          ...(options.devOptions.app.dotenv?.variables ?? {}),
          APP_URL: options.devOptions.url,
        },
        stderr: options.devOptions.stderr,
        stdout: options.devOptions.stdout,
        watchSignal: abortController.signal,
        watch: (error) => {
          if (!error) {
            output.info(`${extension.configuration.name} UI extension javascript built successfully`)
          }

          options.payloadStore
            .updateExtension(extension, {
              status: error ? 'error' : 'success',
            })
            // ESBuild handles error output
            .then((_) => {})
            .catch((_) => {})
        },
      }),
    )

    const localeWatcher = chokidar
      .watch(path.join(extension.directory, 'locales', '**.json'))
      .on('change', (event, path) => {
        output.debug(`Locale file at path ${path} changed`)
        options.payloadStore
          .updateExtension(extension)
          .then((closed) => {
            output.debug(`Notified extension ${extension.devUUID} about the locale change.`)
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .catch((_: any) => {})
      })

    abortController.signal.addEventListener('abort', () => {
      output.debug(`Closing locale file watching for extension with ID ${extension.devUUID}`)
      localeWatcher
        .close()
        .then(() => {
          output.debug(`Locale file watching closed for extension with ${extension.devUUID}`)
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((error: any) => {
          output.debug(
            `Locale file watching failed to close for extension with ${extension.devUUID}: ${error.message}`,
            output.consoleError,
          )
        })
    })
  })

  await Promise.all(bundlers)

  return {
    close: () => {
      abortController.abort()
    },
  }
}
