import {ExtensionsPayloadStore} from './payload/store.js'
import {ExtensionDevOptions} from '../extension.js'
import {bundleExtension} from '../../extensions/bundle.js'
import {abort, path, output} from '@shopify/cli-kit'
import chokidar from 'chokidar'

export interface WatchEvent {
  path: string
  type: 'build' | 'localization'
}

interface FileWatcherOptions {
  devOptions: ExtensionDevOptions
  payloadStore: ExtensionsPayloadStore
}

export interface FileWatcher {
  close: () => void
}

export function setupBundlerAndFileWatcher(options: FileWatcherOptions) {
  const abortController = new abort.Controller()

  options.devOptions.extensions.forEach((extension) => {
    // TODO: Something here is not working as expected
    const esbuild = await bundleExtension({
      minify: false,
      outputBundlePath: extension.outputBundlePath,
      sourceFilePath: extension.entrySourceFilePath,
      environment: 'development',
      env: options.devOptions.app.dotenv?.variables ?? {},
      stderr: options.devOptions.stderr,
      stdout: options.devOptions.stdout,
      watchSignal: abortController.signal,
      watch: (error, result) => {
        output.debug(
          `The Javascript bundle of the UI extension with ID ${extension.devUUID} has ${
            error ? 'an error' : 'changed'
          }`,
        )

        options.payloadStore
          .updateExtension(extension, {
            status: error ? 'error' : 'success',
          })
          .then((_) => {
            // TODO: Show logs
          })
          .catch((_) => {
            // TODO: Show logs
          })
      },
    })

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
  return {
    close: () => {
      abortController.abort()
    },
  }
}
