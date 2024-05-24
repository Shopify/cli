import {BaseProcess, DevProcessFunction} from './types.js'
import {devSessionExtensionWatcher} from './dev-session-utils.js'
import {installJavy} from '../../function/build.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppInterface} from '../../../models/app/app.js'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {zip} from '@shopify/cli-kit/node/archiver'
import {Writable} from 'stream'

export interface DevSessionOptions {
  extensions: ExtensionInstance[]
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  url: string
  app: AppInterface
  organizationId: string
}

export interface DevSessionProcessOptions extends DevSessionOptions {
  bundlePath: string
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
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
  const {extensions, developerPlatformClient, app} = options
  await installJavy(app)

  async function refreshToken() {
    await developerPlatformClient.refreshToken()
  }

  const extensionsInManifest = await app.draftableExtensions.filter((extension) => {
    return extension.configurationPath === app.configuration.path
  })

  await inTemporaryDirectory(async (tmpDir) => {
    const bundlePath = joinPath(tmpDir, 'bundle')
    await mkdir(bundlePath)

    const processOptions = {...options, stderr, stdout, signal, bundlePath}

    await initialBuild(processOptions)
    await bundleExtensionsAndUpload(processOptions)
    const manifestWatcher = undefined
    const newExtensionsWatcher = undefined
    const deletedExtensionsWatcher = undefined

    const extensionWatchers = extensions.map(async (extension) => {
      return devSessionExtensionWatcher({
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
    })
    await Promise.all(extensionWatchers)
  })
}

// Build all extensions into the bundle path
async function initialBuild(options: DevSessionProcessOptions) {
  const allPromises = options.app.realExtensions.map((extension) => {
    return extension.buildForBundle(
      {...options, app: options.app, environment: 'development'},
      options.bundlePath,
      undefined,
    )
  })
  await Promise.all(allPromises)
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

  // API TODO: Get signed URL
  // const signedURL = await getExtensionUploadURL(options.developerPlatformClient, options.apiKey)

  // API TODO: Upload zip file to GCS' signed URL
  // const form = formData()
  // const buffer = readFileSync(bundleZipPath)
  // form.append('my_upload', buffer)
  // await fetch(signedURL, {
  //   method: 'put',
  //   body: buffer,
  //   headers: form.getHeaders(),
  // })

  // API TODO: Deploy the GCS URL to the Dev Session
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
