import {BaseProcess, DevProcessFunction} from './types.js'
import {subscribeToAppEvents} from './dev-session/app-event-watcher.js'
import {installJavy} from '../../function/build.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppInterface} from '../../../models/app/app.js'
import {getExtensionUploadURL} from '../../deploy/upload.js'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {inTemporaryDirectory, mkdir, readFileSync, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {zip} from '@shopify/cli-kit/node/archiver'
import {formData} from '@shopify/cli-kit/node/http'
import {Writable} from 'stream'

export interface DevSessionOptions {
  extensions: ExtensionInstance[]
  developerPlatformClient: DeveloperPlatformClient
  storeFqdn: string
  apiKey: string
  url: string
  app: AppInterface
  organizationId: string
  appId: string
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
  const {developerPlatformClient, app} = options
  await installJavy(app)

  async function refreshToken() {
    await developerPlatformClient.refreshToken()
  }

  // Extensions defined in the app toml that don't have any other watch paths
  // const extensionsInManifest = await app.draftableExtensions.filter(async (extension) => {
  //   const watchPaths = (await extension.watchConfigurationPaths()).concat(extension.watchBuildPaths ?? [])
  //   return watchPaths.length === 1 && watchPaths[0] === app.configuration.path
  // })

  // Extensions (defined in any toml) that need a custom watcher because they have custom paths
  // const extensions = await asyncFilter(app.realExtensions, async (extension) => {
  //   const watchPaths = (await extension.watchConfigurationPaths()).concat(extension.watchBuildPaths ?? [])
  //   if (watchPaths.length === 0) return false
  //   return watchPaths.length > 1 || watchPaths[0] !== app.configuration.path
  // })

  // Review if this extension list makes sense

  await inTemporaryDirectory(async (tmpDir) => {
    const dir = '/Users/isaac/Desktop/testing'
    const bundlePath = joinPath(dir, 'bundle')
    await mkdir(bundlePath)

    const processOptions = {...options, stderr, stdout, signal, bundlePath}

    processOptions.stdout.write('Starting initial build and bundle process...')
    await initialBuild(processOptions)
    await bundleExtensionsAndUpload(processOptions)

    const onChange = async () => {
      return performActionWithRetryAfterRecovery(async () => {
        // bundleExtensionsAndUpload(processOptions)
        processOptions.stdout.write('[MOCK] Call devSessionUpdate')
      }, refreshToken)
    }

    // const extensionWatchers = app.draftableExtensions.map(async (extension) => {
    //   return devSessionExtensionWatcher({...processOptions, extension, onChange})
    // })

    await subscribeToAppEvents(app, processOptions, (event) => {
      const events = event.extensionEvents.map((eve) => {
        return `->> ${eve.type} :: ${eve.extension.handle} :: ${eve.extension.directory}`
      })
      processOptions.stdout.write(JSON.stringify(events, null, 2))
    })
    processOptions.stdout.write(`Dev session ready, watching for changes in your app`)
    // const newWatcher = newExtensionWatcher({...processOptions, onChange})

    // const manifestWatcher = devSessionManifestWatcher({...processOptions, onChange})
    // await Promise.all([...extensionWatchers, newWatcher])
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

  const signedURL = await getExtensionUploadURL(options.developerPlatformClient, {
    apiKey: options.apiKey,
    organizationId: options.organizationId,
    id: options.appId,
  })

  const form = formData()
  const buffer = readFileSync(bundleZipPath)
  form.append('my_upload', buffer)
  await fetch(signedURL, {
    method: 'put',
    body: buffer,
    headers: form.getHeaders(),
  })

  // API TODO: Deploy the GCS URL to the Dev Session
  const result = await options.developerPlatformClient.devSessionDeploy({
    shopName: options.storeFqdn,
    appId: options.apiKey,
    assetsUrl: 'signedURL',
  })

  if (result.devSessionCreate.userErrors.length > 0) {
    options.stderr.write('Dev Session Error')
    options.stderr.write(JSON.stringify(result.devSessionCreate.userErrors, null, 2))
  }
}
