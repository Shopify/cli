import {DevSessionProcessOptions} from './dev-session.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {ExtensionBuildOptions} from '../../build/extension.js'
import {reloadExtensionConfig} from '../update-extension.js'
import {defaultExtensionDirectory} from '../../../models/app/loader.js'
import {outputDebug, outputInfo, outputWarn} from '@shopify/cli-kit/node/output'
import {FSWatcher} from 'chokidar'
import micromatch from 'micromatch'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {joinPath} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

interface ExtensionWatcherOptions extends DevSessionProcessOptions {
  extension: ExtensionInstance
  onChange: () => Promise<void>
}

interface AppWatcherOptions extends DevSessionProcessOptions {
  onChange: () => Promise<void>
}

export async function devSessionManifestWatcher({app, stdout, stderr, signal, onChange}: AppWatcherOptions) {
  const {default: chokidar} = await import('chokidar')

  const manifestWatcher = chokidar.watch(app.configuration.path).on('change', (path) => {
    outputDebug(`App manifest at path ${path} changed`, stdout)
    onChange().catch((error: Error) => {
      outputWarn(`Failed to update app manifest: ${error.message}`, stdout)
    })
  })
  listenForAbortOnWatcheraa(signal, manifestWatcher, 'app manifest', stdout, stderr)
}

export async function newExtensionWatcher({app, stdout}: AppWatcherOptions) {
  const {default: chokidar} = await import('chokidar')

  const existingTomls = app.realExtensions.map((extension) => extension.configurationPath)

  // chokidar will report all files in the directory when it starts watching
  // so we need to filter out the ones that already exist
  chokidar.watch(joinPath(app.directory, defaultExtensionDirectory, '**/*.toml')).on('add', (path) => {
    outputInfo(`New extension added at path ${path}`, stdout)
  })
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

  listenForAbortOnWatcheraa(signal, functionRebuildAndRedeployWatcher, extension.devUUID, stdout, stderr)
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

const listenForAbortOnWatcheraa = (
  signal: AbortSignal,
  watcher: FSWatcher,
  identifier: string,
  stdout: Writable,
  stderr: Writable,
) => {
  signal.addEventListener('abort', () => {
    outputDebug(`Closing file watching for ${identifier}`, stdout)
    watcher
      .close()
      .then(() => {
        outputDebug(`File watching closed for ${identifier}`, stdout)
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((error: any) => {
        outputDebug(`File watching failed to close for ${identifier}: ${error.message}`, stderr)
      })
  })
}
