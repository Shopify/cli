import {BaseProcess, DevProcessFunction} from './types.js'
import {installJavy} from '../../function/build.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppInterface} from '../../../models/app/app.js'
import {reloadExtensionConfig, updateExtensionDraft} from '../update-extension.js'
import {setupExtensionWatcher} from '../extension/bundler.js'
import {bundleAndBuildExtensions} from '../../deploy/bundle.js'
import {getExtensionUploadURL} from '../../deploy/upload.js'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {inTemporaryDirectory, mkdir, readFileSync, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {formData} from '@shopify/cli-kit/node/http'
import {Writable} from 'stream'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {FSWatcher} from 'chokidar'
import {deepCompare} from '@shopify/cli-kit/common/object'
import {ExtensionBuildOptions} from '../../build/extension.js'
import micromatch from 'micromatch'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {DevContextOptions} from '../../context.js'
import {zip} from '@shopify/cli-kit/node/archiver'

interface DevSessionOptions {
  extensions: ExtensionInstance[]
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  url: string
  app: AppInterface
  organizationId: string
}

interface DevSessionProcessOptions extends DevSessionOptions {
  bundlePath: string
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
}

interface ExtensionWatcherOptions extends DevSessionProcessOptions {
  extension: ExtensionInstance
  onChange: () => Promise<void>
}

export interface DevSessionProcess extends BaseProcess<DevSessionOptions> {
  type: 'dev-session'
}

export async function setupDevSessionProcess({
  app,
  apiKey,
  developerPlatformClient,
  ...options
}: Omit<DevSessionOptions, 'extensions'>): Promise<DevSessionProcess | undefined> {
  const draftableExtensions = app.draftableExtensions
  if (draftableExtensions.length === 0) {
    return
  }

  return {
    type: 'dev-session',
    prefix: 'extensions',
    function: pushUpdatesForDevSession,
    options: {
      app,
      apiKey,
      developerPlatformClient,
      ...options,
      extensions: draftableExtensions,
    },
  }
}

export const pushUpdatesForDevSession: DevProcessFunction<DevSessionOptions> = async (
  {stderr, stdout, abortSignal: signal},
  options,
) => {
  // Force the download of the javy binary in advance to avoid later problems,
  // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
  const {extensions, developerPlatformClient, apiKey, app} = options
  await installJavy(app)

  async function refreshToken() {
    await developerPlatformClient.refreshToken()
  }

  await inTemporaryDirectory(async (tmpDir) => {
    const myDir = '/Users/isaac/Desktop/testing'
    const bundlePath = joinPath(myDir, 'bundle')
    await mkdir(bundlePath)

    const processOptions = {...options, stderr, stdout, signal, bundlePath}

    await initialBuild(processOptions)
    await bundleExtensionsAndUpload(processOptions)

    await Promise.all(
      extensions.map(async (extension) => {
        // Watch for changes
        return extensionWatcher({
          ...processOptions,
          extension,
          onChange: async () => {
            // At this point the extension has already been built and is ready to be updated
            return performActionWithRetryAfterRecovery(
              async () => bundleExtensionsAndUpload(processOptions),
              refreshToken,
            )
          },
        })
      }),
    )
  })
}

// Build all extensions into the bundle path
async function initialBuild(options: DevSessionProcessOptions) {
  await Promise.all(
    options.app.realExtensions.map((extension) => {
      extension.buildForBundle(
        {...options, app: options.app, environment: 'development'},
        options.bundlePath,
        undefined,
      )
    }),
  )
}

async function bundleExtensionsAndUpload(options: DevSessionProcessOptions) {
  // Build and bundle all extensions in a zip file (including the manifest file)
  const bundleZipPath = joinPath(dirname(options.bundlePath), `bundle.zip`)

  // Include manifest in bundle
  const appManifest = await options.app.manifest()
  const manifestPath = joinPath(options.bundlePath, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(appManifest, null, 2))

  // Create zip file with everything
  await zip({
    inputDirectory: options.bundlePath,
    outputZipPath: bundleZipPath,
  })

  // // Get signed URL
  // const signedURL = await getExtensionUploadURL(options.developerPlatformClient, options.apiKey)

  // // Upload zip file to GCS' signed URL
  // const form = formData()
  // const buffer = readFileSync(bundleZipPath)
  // form.append('my_upload', buffer)
  // await fetch(signedURL, {
  //   method: 'put',
  //   body: buffer,
  //   headers: form.getHeaders(),
  // })

  // // Deploy the GCS URL to the Dev Session
  // const result = await options.developerPlatformClient.devSessionDeploy({
  //   organizationId: options.organizationId,
  //   appId: options.apiKey,
  //   url: signedURL,
  // })

  // if (result.devSession.userErrors) {
  //   options.stderr.write('Dev Session Error')
  //   options.stderr.write(JSON.stringify(result.devSession.userErrors, null, 2))
  // }
}

async function extensionWatcher({
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
      .then(({newConfig, previousConfig}) => {
        if (shouldBuild) {
          if (buildSignal.aborted) return
          return onChange()
        }

        if (deepCompare(newConfig, previousConfig)) return
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
