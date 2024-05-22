import {DevSessionProcessOptions} from './dev-session.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {ExtensionBuildOptions} from '../../build/extension.js'
import {reloadExtensionConfig} from '../update-extension.js'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {FSWatcher} from 'chokidar'
import micromatch from 'micromatch'
import {AbortController} from '@shopify/cli-kit/node/abort'

interface ExtensionWatcherOptions extends DevSessionProcessOptions {
  extension: ExtensionInstance
  onChange: () => Promise<void>
}

export async function devSessionExtensionWatcher({
  extension,
  app,
  url,
  stdout,
  stderr,
  signal,
  onChange,
  bundlePath,
}: ExtensionWatcherOptions) {
  const {default: chokidar} = await import('chokidar')

  const buildPaths = extension.watchBuildPaths ?? []
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
  const functionRebuildAndRedeployWatcher = chokidar.watch(allPaths, {ignored: '**/*.test.*'}).on('change', (path) => {
    outputDebug(`Extension file at path ${path} changed`, stdout)
    if (buildController) {
      // terminate any existing builds
      buildController.abort()
    }
    buildController = new AbortController()
    const buildSignal = buildController.signal
    const shouldBuild = micromatch.isMatch(path, buildPaths)

    reloadAndbuildIfNecessary(extension, shouldBuild, bundlePath, {
      app,
      stdout,
      stderr,
      useTasks: false,
      signal: buildSignal,
      environment: 'development',
      appURL: url,
    })
      .then(() => {
        if (shouldBuild && buildSignal.aborted) return
        return onChange()
      })
      .catch((updateError: Error) => {
        const draftUpdateErrorMessage = extension.draftMessages.errorMessage
        if (draftUpdateErrorMessage) {
          outputWarn(`${draftUpdateErrorMessage}: ${updateError.message}`, stdout)
        }
      })
  })
  listenForAbortOnWatcher(functionRebuildAndRedeployWatcher)
}

async function reloadAndbuildIfNecessary(
  extension: ExtensionInstance,
  build: boolean,
  bundlePath: string,
  options: ExtensionBuildOptions,
) {
  const reloadedConfig = reloadExtensionConfig({extension, stdout: options.stdout})
  if (!build) return reloadedConfig
  return extension.buildForBundle(options, bundlePath, undefined).then(() => reloadedConfig)
}
