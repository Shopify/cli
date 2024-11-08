import {ExtensionsPayloadStore} from './payload/store.js'
import {ExtensionDevOptions} from '../extension.js'
import {bundleExtension} from '../../extensions/bundle.js'

import {AppInterface} from '../../../models/app/app.js'
import {reloadExtensionConfig} from '../update-extension.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {ExtensionBuildOptions} from '../../build/extension.js'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {FSWatcher} from 'chokidar'
import micromatch from 'micromatch'
import {deepCompare} from '@shopify/cli-kit/common/object'
import {Writable} from 'stream'
import {AsyncResource} from 'async_hooks'
import type {Loader} from 'esbuild'

export interface FileWatcherOptions {
  devOptions: ExtensionDevOptions
  payloadStore: ExtensionsPayloadStore
}

interface Overrides {
  contents?: string
  loader?: Loader
  outputPath?: string
}

export async function setupBundlerAndFileWatcher(options: FileWatcherOptions) {
  const {default: chokidar} = await import('chokidar')
  const abortController = new AbortController()

  const bundlers: Promise<void>[] = []

  const extensions = options.devOptions.extensions.filter((ext) => ext.isESBuildExtension)

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  extensions.forEach(async (extension) => {
    const {conditions, targets} = extension.getBundleExtensionStdinContent()
    const bundleExtensionWithOverrides = (overrides?: Overrides) =>
      bundleExtension({
        minify: false,
        outputPath: overrides?.outputPath || extension.outputPath,
        environment: 'development',
        env: {
          ...(options.devOptions.appDotEnvFile?.variables ?? {}),
          APP_URL: options.devOptions.url,
        },
        stdin: {
          contents: overrides?.contents || targets,
          resolveDir: extension.directory,
          loader: overrides?.loader || 'tsx',
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
      })

    bundlers.push(bundleExtensionWithOverrides())

    if (conditions) {
      // This is BAD... why isn't targeting part of this type? Where do we change it?
      const outputPath = joinPath(dirname(extension.outputPath), `${extension.configuration.handle}-conditions.js`)

      bundlers.push(
        bundleExtensionWithOverrides({
          contents: conditions,
          loader: 'ts',
          outputPath: outputPath,
        }),
      )
    }

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
  url?: string
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
  onChange: () => Promise<void>
  onReloadAndBuildError: (error: Error) => Promise<void>
}

export async function setupExtensionWatcher({
  extension,
  app,
  url,
  stdout,
  stderr,
  signal,
  onChange,
  onReloadAndBuildError,
}: SetupExtensionWatcherOptions) {
  const {default: chokidar} = await import('chokidar')

  const buildPaths = extension.watchBuildPaths

  if (!buildPaths) {
    outputWarn(
      `Extension ${extension.localIdentifier} is missing the 'build.watch' setting, automatic builds are disabled.`,
      stdout,
    )
    return
  }
  const configurationPaths: string[] = await extension.watchConfigurationPaths()

  outputDebug(
    `
Watching extension: ${extension.localIdentifier} for:
Rebuild and Redeploy Paths:
\t${buildPaths.join('\n\t')}

Redeploy Paths:
\t${configurationPaths.join('\n\t')}
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
  const allPaths = [...buildPaths, ...configurationPaths]
  const functionRebuildAndRedeployWatcher = chokidar.watch(allPaths, {ignored: '**/*.test.*'}).on(
    'change',
    // We need to bind the execution context to ensure the event handler can access the correct AsyncLocalStorage
    // See also: https://nodejs.org/api/async_context.html#integrating-asyncresource-with-eventemitter
    AsyncResource.bind((path) => {
      outputDebug(`Extension file at path ${path} changed`, stdout)
      if (buildController) {
        // terminate any existing builds
        buildController.abort()
      }
      buildController = new AbortController()
      const buildSignal = buildController.signal
      const shouldBuild = micromatch.isMatch(path, buildPaths)

      reloadAndbuildIfNecessary(extension, shouldBuild, {
        app,
        stdout,
        stderr,
        useTasks: false,
        signal: buildSignal,
        environment: 'development',
        appURL: url,
      })
        .then(({newConfig, previousConfig}) => {
          if (shouldBuild) {
            if (buildSignal.aborted) return
            return onChange()
          }

          if (deepCompare(newConfig, previousConfig)) return
          return onChange()
        })
        .catch((error: Error) => onReloadAndBuildError(error))
    }),
  )
  listenForAbortOnWatcher(functionRebuildAndRedeployWatcher)
}

async function reloadAndbuildIfNecessary(extension: ExtensionInstance, build: boolean, options: ExtensionBuildOptions) {
  const reloadedConfig = reloadExtensionConfig({extension, stdout: options.stdout})
  if (!build) return reloadedConfig
  return extension.build(options).then(() => reloadedConfig)
}
