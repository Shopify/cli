import {ExtensionsPayloadStore} from './payload/store.js'
import {ExtensionDevOptions} from '../extension.js'
import {bundleExtension} from '../../extensions/bundle.js'

import {AppInterface} from '../../../models/app/app.js'
import {updateExtensionConfig, updateExtensionDraft} from '../update-extension.js'
import {buildFunctionExtension} from '../../../services/build/extension.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputDebug, outputInfo, outputWarn} from '@shopify/cli-kit/node/output'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {FSWatcher} from 'chokidar'
import {Writable} from 'stream'

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

export type ExtensionWithRegistrationId = ExtensionInstance & {registrationId: string}

export async function setupBundlerAndFileWatcher(options: FileWatcherOptions) {
  const {default: chokidar} = await import('chokidar')
  const abortController = new AbortController()

  const bundlers: Promise<void>[] = []

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  options.devOptions.extensions.forEach(async (extension) => {
    bundlers.push(
      bundleExtension({
        minify: false,
        outputPath: extension.outputPath,
        environment: 'development',
        env: {
          ...(options.devOptions.appDotEnvFile?.variables ?? {}),
          APP_URL: options.devOptions.url,
        },
        stdin: {
          contents: extension.getBundleExtensionStdinContent(),
          resolveDir: extension.directory,
          loader: 'tsx',
        },
        stderr: options.devOptions.stderr,
        stdout: options.devOptions.stdout,
        watchSignal: abortController.signal,
        watch: async (result) => {
          const error = (result?.errors?.length ?? 0) > 0
          outputDebug(
            `The Javascript bundle of the UI extension with ID ${extension.devUUID} has ${
              error ? 'an error' : 'changed'
            }`,
            error ? options.devOptions.stderr : options.devOptions.stdout,
          )

          try {
            await options.payloadStore.updateExtension(extension, options.devOptions, {
              status: error ? 'error' : 'success',
            })
            // eslint-disable-next-line no-catch-all/no-catch-all
          } catch {
            // ESBuild handles error output
          }
        },
        sourceMaps: true,
      }),
    )

    const localeWatcher = chokidar
      .watch(joinPath(extension.directory, 'locales', '**.json'))
      .on('change', (_event, path) => {
        outputDebug(`Locale file at path ${path} changed`, options.devOptions.stdout)
        options.payloadStore
          .updateExtension(extension, options.devOptions)
          .then((_closed) => {
            outputDebug(`Notified extension ${extension.devUUID} about the locale change.`, options.devOptions.stdout)
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .catch((_: any) => {})
      })

    abortController.signal.addEventListener('abort', () => {
      outputDebug(`Closing locale file watching for extension with ID ${extension.devUUID}`, options.devOptions.stdout)
      localeWatcher
        .close()
        .then(() => {
          outputDebug(`Locale file watching closed for extension with ${extension.devUUID}`, options.devOptions.stdout)
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((error: any) => {
          outputDebug(
            `Locale file watching failed to close for extension with ${extension.devUUID}: ${error.message}`,
            options.devOptions.stderr,
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

interface SetupDraftableExtensionBundlerOptions {
  extension: ExtensionInstance
  app: AppInterface
  url: string
  token: string
  apiKey: string
  registrationId: string
  stderr: Writable
  stdout: Writable
  signal: AbortSignal
  unifiedDeployment: boolean
}

export async function setupDraftableExtensionBundler({
  extension,
  app,
  url,
  token,
  apiKey,
  registrationId,
  stderr,
  stdout,
  signal,
  unifiedDeployment,
}: SetupDraftableExtensionBundlerOptions) {
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
    stderr,
    stdout,
    watchSignal: signal,

    watch: async (result) => {
      const error = (result?.errors?.length ?? 0) > 0
      outputInfo(
        `The Javascript bundle of the extension with ID ${extension.devUUID} has ${error ? 'an error' : 'changed'}`,
        error ? stderr : stdout,
      )
      if (error) return

      await updateExtensionDraft({extension, token, apiKey, registrationId, stdout, stderr, unifiedDeployment})
    },
  })
}

interface SetupConfigWatcherOptions {
  extension: ExtensionInstance
  token: string
  apiKey: string
  registrationId: string
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
  unifiedDeployment: boolean
}

export async function createConfigWatcher(path: string, onChange: () => void) {
  const {default: chokidar} = await import('chokidar')

  return chokidar.watch(path).on('change', onChange)
}

export async function setupConfigWatcher(options: SetupConfigWatcherOptions) {
  const {extension, token, apiKey, registrationId, stdout, stderr, signal, unifiedDeployment} = options

  const appConfigWatcher = await createConfigWatcher(extension.configuration.path, () => {
    outputInfo(`Config file at path ${extension.configuration.path} changed`, stdout)
    updateExtensionConfig({
      extension,
      token,
      apiKey,
      registrationId,
      stdout,
      stderr,
      unifiedDeployment,
    }).catch((_: unknown) => {})
  })

  signal.addEventListener('abort', () => {
    outputDebug(`Closing config file watching for extension with ID ${extension.devUUID}`, stdout)
    appConfigWatcher
      .close()
      .then(() => {
        outputDebug(`Config file watching closed for extension with ${extension.devUUID}`, stdout)
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((error: any) => {
        outputDebug(
          `Config file watching failed to close for extension with ${extension.devUUID}: ${error.message}`,
          stderr,
        )
      })
  })
}

export interface SetupFunctionWatcherOptions {
  extension: ExtensionInstance
  app: AppInterface
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
  token: string
  apiKey: string
  registrationId: string
  unifiedDeployment: boolean
}

export async function setupFunctionWatcher({
  extension,
  app,
  stdout,
  stderr,
  signal,
  token,
  apiKey,
  registrationId,
  unifiedDeployment,
}: SetupFunctionWatcherOptions) {
  const {default: chokidar} = await import('chokidar')

  const rebuildAndRedeployWatchPaths = extension.watchPaths
  const redeployWatchPaths: string[] = []

  if (!rebuildAndRedeployWatchPaths) {
    outputWarn(
      `Function extension ${extension.localIdentifier} is missing the 'build.watch' setting, automatic builds are disabled.`,
      stdout,
    )
    return
  }

  if (await fileExists(joinPath(extension.directory, 'locales'))) {
    redeployWatchPaths.push(joinPath(extension.directory, 'locales', '**.json'))
  }

  outputDebug(
    `
Watching function extension: ${extension.localIdentifier} for:
Rebuild and Redeploy Paths:
\t${rebuildAndRedeployWatchPaths.join('\n\t')}

Redeploy Paths:
\t${redeployWatchPaths.join('\n\t')}
`.trim(),
    stdout,
  )

  const listenForAbortOnWatcher = (watcher: FSWatcher) => {
    signal.addEventListener('abort', () => {
      outputDebug(`Closing function file watching for extension with ID ${extension.devUUID}`, stdout)
      watcher
        .close()
        .then(() => {
          outputDebug(`Function file watching closed for extension with ${extension.devUUID}`, stdout)
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((error: any) => {
          outputDebug(
            `Function file watching failed to close for extension with ${extension.devUUID}: ${error.message}`,
            stderr,
          )
        })
    })
  }

  let buildController: AbortController | null

  const functionRebuildAndRedeployWatcher = chokidar.watch(rebuildAndRedeployWatchPaths).on('change', (path) => {
    outputDebug(`Function extension file at path ${path} changed`, stdout)
    if (buildController) {
      // terminate any existing builds
      buildController.abort()
    }
    buildController = new AbortController()
    const buildSignal = buildController.signal
    buildFunctionExtension(extension, {
      app,
      stdout,
      stderr,
      useTasks: false,
      signal: buildSignal,
    })
      .then(() => {
        if (!buildSignal.aborted) {
          return updateExtensionDraft({extension, token, apiKey, registrationId, stdout, stderr, unifiedDeployment})
        }
      })
      .catch((updateError: unknown) => {
        outputWarn(`Error while deploying updated extension draft: ${JSON.stringify(updateError, null, 2)}`, stdout)
      })
  })
  listenForAbortOnWatcher(functionRebuildAndRedeployWatcher)

  if (redeployWatchPaths.length > 0) {
    const functionRedeployWatcher = chokidar.watch(redeployWatchPaths).on('change', (path) => {
      outputDebug(`File at path ${path} changed`, stdout)
      updateExtensionConfig({
        extension,
        token,
        apiKey,
        registrationId,
        stdout,
        stderr,
        unifiedDeployment,
      }).catch((error: unknown) => {
        outputWarn(
          `Error while deploying updated extension config: ${JSON.stringify(error, null, 2)} at path ${path}`,
          stdout,
        )
      })
    })
    listenForAbortOnWatcher(functionRedeployWatcher)
  }
}

export async function setupAppConfigWatcher({
  path,
  extensions,
  stdout,
  stderr,
  token,
  apiKey,
  unifiedDeployment,
  signal,
}: {path: string; extensions: ExtensionWithRegistrationId[]} & Omit<
  SetupConfigWatcherOptions,
  'extension' | 'registrationId'
>) {
  const appConfigWatcher = await createConfigWatcher(path, () => {
    outputInfo(`Config file at path ${path} changed`, stdout)

    Promise.all(
      extensions.map(async (extension) => {
        return updateExtensionConfig({
          extension,
          token,
          apiKey,
          registrationId: extension.registrationId,
          stdout,
          stderr,
          unifiedDeployment,
        })
      }),
    ).catch((_: unknown) => {})
  })

  signal.addEventListener('abort', () => {
    outputDebug(`Closing config file watching for file at path ${path}`, stdout)

    appConfigWatcher
      .close()
      .then(() => {
        outputDebug(`Config file watching closed for file at path ${path}`, stdout)
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((error: any) => {
        outputDebug(`Config file watching failed to close for file at path ${path} with ${error.message}`, stderr)
      })
  })
}
