import {BaseProcess, DevProcessFunction} from './types.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {getExtensionUploadURL} from '../../deploy/upload.js'
import {AppEventWatcher, EventType} from '../app-events/app-event-watcher.js'
import {reloadApp} from '../app-events/app-event-watcher-handler.js'
import {readFileSync, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {zip} from '@shopify/cli-kit/node/archiver'
import {formData, fetch} from '@shopify/cli-kit/node/http'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {endHRTimeInMs, startHRTime} from '@shopify/cli-kit/node/hrtime'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {Writable} from 'stream'

interface DevSessionOptions {
  developerPlatformClient: DeveloperPlatformClient
  storeFqdn: string
  apiKey: string
  url: string
  app: AppLinkedInterface
  organizationId: string
  appId: string
}

interface DevSessionProcessOptions extends DevSessionOptions {
  url: string
  bundlePath: string
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
}

export interface DevSessionProcess extends BaseProcess<DevSessionOptions> {
  type: 'dev-session'
}

let bundleControllers: AbortController[] = []

export async function setupDevSessionProcess({
  app,
  apiKey,
  developerPlatformClient,
  ...options
}: Omit<DevSessionOptions, 'extensions'>): Promise<DevSessionProcess | undefined> {
  return {
    type: 'dev-session',
    prefix: 'extensions',
    function: pushUpdatesForDevSession,
    options: {
      app,
      apiKey,
      developerPlatformClient,
      ...options,
    },
  }
}

export const pushUpdatesForDevSession: DevProcessFunction<DevSessionOptions> = async (
  {stderr, stdout, abortSignal: signal},
  options,
) => {
  const {developerPlatformClient} = options

  // Reload the app before starting the dev session, at this point the configuration has changed (e.g. application_url)
  const app = await reloadApp(options.app, {stderr, stdout, signal})

  const refreshToken = async () => {
    return developerPlatformClient.refreshToken()
  }

  const appWatcher = new AppEventWatcher(app, options.url, {stderr, stdout, signal})

  const processOptions = {...options, stderr, stdout, signal, bundlePath: appWatcher.buildOutputPath}

  outputWarn('-----> Using DEV SESSIONS <-----')
  processOptions.stdout.write('Preparing dev session...')

  await bundleExtensionsAndUpload(processOptions, false)

  appWatcher.onEvent(async (event) => {
    // Cancel any ongoing bundle and upload process
    bundleControllers.forEach((controller) => controller.abort())
    // Remove aborted controllers from array:
    bundleControllers = bundleControllers.filter((controller) => !controller.signal.aborted)

    event.extensionEvents.map((eve) => {
      switch (eve.type) {
        case EventType.Created:
          processOptions.stdout.write(`✅ Extension created ->> ${eve.extension.handle}`)
          break
        case EventType.Deleted:
          processOptions.stdout.write(`❌ Extension deleted ->> ${eve.extension.handle}`)
          break
        case EventType.Updated:
          processOptions.stdout.write(`🔄 Extension Updated ->> ${eve.extension.handle}`)
          break
      }
    })

    const networkStartTime = startHRTime()
    await performActionWithRetryAfterRecovery(async () => {
      const result = await bundleExtensionsAndUpload({...processOptions, app: event.app}, true)
      const endTime = endHRTimeInMs(event.startTime)
      const endNetworkTime = endHRTimeInMs(networkStartTime)
      if (result) {
        processOptions.stdout.write(`✅ Session updated [Network: ${endNetworkTime}ms -- Total: ${endTime}ms]`)
      } else {
        processOptions.stdout.write(
          `❌ Session update aborted (new change detected) [Network: ${endNetworkTime}ms -- Total: ${endTime}ms]`,
        )
      }
    }, refreshToken)
  })

  // Start watching for changes in the app
  await appWatcher.start()
  processOptions.stdout.write(`Dev session ready, watching for changes in your app`)
}

/**
 * Bundle all extensions and upload them to the developer platform
 * Generate a new manifest in the bundle folder, zip it and upload it to GCS.
 * Then create or update the dev session with the new assets URL.
 *
 * @param options - The options for the process
 * @param updating - Whether the dev session is being updated or created
 */
async function bundleExtensionsAndUpload(options: DevSessionProcessOptions, updating: boolean) {
  // Every new bundle process gets its own controller. This way we can cancel any previous one if a new change
  // is detected even when multiple events are triggered very quickly (which causes weird edge cases)
  const currentBundleController = new AbortController()
  bundleControllers.push(currentBundleController)

  if (currentBundleController.signal.aborted) return false
  outputDebug('Bundling and uploading extensions', options.stdout)
  const bundleZipPath = joinPath(dirname(options.bundlePath), `bundle.zip`)

  // Generate app manifest in the bundle folder (overwriting the previous one)
  const appManifest = await options.app.manifest()
  const manifestPath = joinPath(options.bundlePath, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(appManifest, null, 2))

  // Create zip file with everything
  if (currentBundleController.signal.aborted) return false
  await zip({
    inputDirectory: options.bundlePath,
    outputZipPath: bundleZipPath,
  })

  // Get a signed URL to upload the zip file
  if (currentBundleController.signal.aborted) return false
  const signedURL = await getExtensionUploadURL(options.developerPlatformClient, {
    apiKey: options.appId,
    organizationId: options.organizationId,
    id: options.appId,
  })

  // Upload the zip file
  if (currentBundleController.signal.aborted) return false
  const form = formData()
  const buffer = readFileSync(bundleZipPath)
  form.append('my_upload', buffer)
  await fetch(signedURL, {
    method: 'put',
    body: buffer,
    headers: form.getHeaders(),
  })

  const payload = {shopFqdn: options.storeFqdn, appId: options.appId, assetsUrl: signedURL}

  // Create or update the dev session
  if (currentBundleController.signal.aborted) return false
  try {
    if (updating) {
      await options.developerPlatformClient.devSessionUpdate(payload)
    } else {
      await options.developerPlatformClient.devSessionCreate(payload)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.code === '401') {
      throw new Error('Unauthorized')
    } else {
      options.stderr.write(`❌ ${updating ? 'Update' : 'Create'} Dev Session Error`)
      options.stderr.write(error.message)
    }
  }
  return true
}
