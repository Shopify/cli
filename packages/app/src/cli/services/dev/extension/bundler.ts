import {ExtensionsPayloadStore} from './payload/store.js'
import {ExtensionDevOptions} from '../extension.js'
import {bundleExtension} from '../../extensions/bundle.js'

import {AppInterface} from '../../../models/app/app.js'
import {updateExtensionConfig} from '../update-extension.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {ExtensionBuildOptions} from '../../build/extension.js'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {FSWatcher} from 'chokidar'
import micromatch from 'micromatch'
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

export interface SetupExtensionWatcherOptions {
  extension: ExtensionInstance
  app: AppInterface
  url: string
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
  token: string
  apiKey: string
  registrationId: string
}

export async function setupExtensionWatcher({
  extension,
  app,
  url,
  stdout,
  stderr,
  signal,
  token,
  apiKey,
  registrationId,
}: SetupExtensionWatcherOptions) {
  const {default: chokidar} = await import('chokidar')

  const rebuildAndRedeployWatchPaths = extension.watchPaths
  const redeployWatchPaths: string[] = []

  if (!rebuildAndRedeployWatchPaths) {
    outputWarn(
      `Extension ${extension.localIdentifier} is missing the 'build.watch' setting, automatic builds are disabled.`,
      stdout,
    )
    return
  }

  if (await fileExists(joinPath(extension.directory, 'locales'))) {
    redeployWatchPaths.push(joinPath(extension.directory, 'locales', '**.json'))
  }
  redeployWatchPaths.push(joinPath(extension.directory, '**.toml'))

  outputDebug(
    `
Watching extension: ${extension.localIdentifier} for:
Rebuild and Redeploy Paths:
\t${rebuildAndRedeployWatchPaths.join('\n\t')}

Redeploy Paths:
\t${redeployWatchPaths.join('\n\t')}
`.trim(),
    stdout,
  )

  const listenForAbortOnWatcher = (watcher: FSWatcher) => {
    signal.addEventListener('abort', () => {
      outputDebug(`Closing file watching for extension with ID ${extension.devUUID}`, stdout)
      watcher
        .close()
        .then(() => {
          outputDebug(`File watching closed for extension with ${extension.devUUID}`, stdout)
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((error: any) => {
          outputDebug(`File watching failed to close for extension with ${extension.devUUID}: ${error.message}`, stderr)
        })
    })
  }

  let buildController: AbortController | null
  const allPaths = [...rebuildAndRedeployWatchPaths, ...redeployWatchPaths]
  const functionRebuildAndRedeployWatcher = chokidar.watch(allPaths).on('change', (path) => {
    outputDebug(`Extension file at path ${path} changed`, stdout)
    if (buildController) {
      // terminate any existing builds
      buildController.abort()
    }
    buildController = new AbortController()
    const buildSignal = buildController.signal
    const shouldBuild = micromatch.isMatch(path, rebuildAndRedeployWatchPaths)
    buildIfNecessary(extension, shouldBuild, {
      app,
      stdout,
      stderr,
      useTasks: false,
      signal: buildSignal,
      environment: 'development',
      appURL: url,
    })
      .then(() => {
        if (!buildSignal.aborted) {
          return updateExtensionConfig({extension, token, apiKey, registrationId, stdout, stderr})
        }
      })
      .catch((updateError: unknown) => {
        outputWarn(`Error while deploying updated extension draft: ${JSON.stringify(updateError, null, 2)}`, stdout)
      })
  })
  listenForAbortOnWatcher(functionRebuildAndRedeployWatcher)
}

export async function buildIfNecessary(extension: ExtensionInstance, build: boolean, options: ExtensionBuildOptions) {
  if (!build) return
  return extension.build(options)
}
