import {ExtensionsPayloadStore} from './payload/store.js'
import {ExtensionDevOptions} from '../extension.js'

import {AppInterface} from '../../../models/app/app.js'
import {reloadExtensionConfig} from '../update-extension.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {ExtensionBuildOptions} from '../../build/extension.js'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {FSWatcher} from 'chokidar'
import micromatch from 'micromatch'
import {deepCompare} from '@shopify/cli-kit/common/object'
import {Writable} from 'stream'
import {AsyncResource} from 'async_hooks'

export interface FileWatcherOptions {
  devOptions: ExtensionDevOptions
  payloadStore: ExtensionsPayloadStore
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
