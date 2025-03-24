import {BaseProcess, DevProcessFunction} from './types.js'
import {DevSessionStatusManager} from './dev-session-status-manager.js'
import {DevSessionLogger} from './dev-session/dev-session-logger.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {getExtensionUploadURL} from '../../deploy/upload.js'
import {AppEvent, AppEventWatcher} from '../app-events/app-event-watcher.js'
import {readFileSync, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {zip} from '@shopify/cli-kit/node/archiver'
import {formData, fetch} from '@shopify/cli-kit/node/http'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {endHRTimeInMs, startHRTime} from '@shopify/cli-kit/node/hrtime'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ClientError} from 'graphql-request'
import {Writable} from 'stream'

interface DevSessionOptions {
  developerPlatformClient: DeveloperPlatformClient
  storeFqdn: string
  apiKey: string
  url: string
  app: AppLinkedInterface
  organizationId: string
  appId: string
  appWatcher: AppEventWatcher
  appPreviewURL: string
  appLocalProxyURL: string
  devSessionStatusManager: DevSessionStatusManager
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

export interface UserError {
  message: string
  on: JsonMapType
  field?: string[] | null
  category: string
}

interface DevSessionPayload {
  shopFqdn: string
  appId: string
  assetsUrl: string
}

type DevSessionResult =
  | {status: 'updated' | 'created' | 'aborted'}
  | {status: 'remote-error'; error: UserError[]}
  | {status: 'unknown-error'; error: Error}

let bundleControllers: AbortController[] = []

export async function setupDevSessionProcess({
  app,
  apiKey,
  developerPlatformClient,
  ...options
}: Omit<DevSessionOptions, 'extensions'>): Promise<DevSessionProcess | undefined> {
  return {
    type: 'dev-session',
    prefix: 'dev-session',
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
  const {appWatcher, devSessionStatusManager} = options

  const processOptions = {...options, stderr, stdout, signal, bundlePath: appWatcher.buildOutputPath}
  const statusManager = processOptions.devSessionStatusManager
  const logger = new DevSessionLogger(processOptions.stdout)

  await logger.info('Preparing dev session')
  statusManager.setMessage('LOADING')

  appWatcher
    .onEvent(async (event) => {
      if (!devSessionStatusManager.status.isReady) {
        await logger.warning('Change detected, but dev session is not ready yet.')
        return
      }

      // If there are any build errors, don't update the dev session
      const anyError = event.extensionEvents.some((eve) => eve.buildResult?.status === 'error')
      if (anyError) return statusManager.setMessage('BUILD_ERROR')

      if (event.extensionEvents.length === 0) {
        // The app was probably reloaded, but no extensions were affected, we are ready for new changes.
        // But we shouldn't trigger a new dev session update in this case.
        statusManager.setMessage('READY')
        return
      }

      statusManager.setMessage('CHANGE_DETECTED')

      await updatePreviewURL(processOptions, event)

      // Cancel any ongoing bundle and upload process
      bundleControllers.forEach((controller) => controller.abort())
      // Remove aborted controllers from array:
      bundleControllers = bundleControllers.filter((controller) => !controller.signal.aborted)

      await logger.logExtensionEvents(event)

      const networkStartTime = startHRTime()
      const result = await bundleExtensionsAndUpload({...processOptions, app: event.app})
      await handleDevSessionResult(result, {...processOptions, app: event.app}, logger, event)
      outputDebug(
        `✅ Event handled [Network: ${endHRTimeInMs(networkStartTime)}ms - Total: ${endHRTimeInMs(event.startTime)}ms]`,
        processOptions.stdout,
      )
    })
    .onStart(async (event) => {
      const buildErrors = event.extensionEvents.filter((eve) => eve.buildResult?.status === 'error')
      if (buildErrors.length) {
        const errors = buildErrors.map((error) => ({
          error: 'Build error. Please review your code and try again.',
          prefix: error.extension.handle,
        }))
        await logger.logMultipleErrors(errors)
        throw new AbortError('Dev session aborted, build errors detected in extensions.')
      }
      const result = await bundleExtensionsAndUpload({...processOptions, app: event.app})
      await handleDevSessionResult(result, {...processOptions, app: event.app}, logger)
    })
    .onError(async (error) => {
      await handleDevSessionResult({status: 'unknown-error', error}, processOptions, logger)
    })
}

async function handleDevSessionResult(
  result: DevSessionResult,
  processOptions: DevSessionProcessOptions,
  logger: DevSessionLogger,
  event?: AppEvent,
) {
  if (result.status === 'updated') {
    await logger.success(`✅ Updated`)
    await logger.logActionRequiredMessages(processOptions.storeFqdn, event)
    await setUpdatedStatusMessage(processOptions)
  } else if (result.status === 'created') {
    processOptions.devSessionStatusManager.updateStatus({isReady: true})
    await logger.success(`✅ Ready, watching for changes in your app `)
    processOptions.devSessionStatusManager.setMessage('READY')
  } else if (result.status === 'aborted') {
    outputDebug('❌ Session update aborted (new change detected or error in Session Update)', processOptions.stdout)
  } else if (result.status === 'remote-error' || result.status === 'unknown-error') {
    await logger.logUserErrors(result.error, event?.app.allExtensions ?? [])
    if (result.error instanceof Error && result.error.cause === 'validation-error') {
      processOptions.devSessionStatusManager.setMessage('VALIDATION_ERROR')
    } else {
      processOptions.devSessionStatusManager.setMessage('REMOTE_ERROR')
    }
  }

  // If we failed to create a session, exit the process. Don't throw an error in tests as it can't be caught due to the
  // async nature of the process.
  if (!processOptions.devSessionStatusManager.status.isReady && !isUnitTest()) {
    throw new AbortError('Failed to start dev session.')
  }
}

/**
 * Bundle all extensions and upload them to the developer platform
 * Generate a new manifest in the bundle folder, zip it and upload it to GCS.
 * Then create or update the dev session with the new assets URL.
 *
 * @param options - The options for the process
 * @param updating - Whether the dev session is being updated or created
 */
async function bundleExtensionsAndUpload(options: DevSessionProcessOptions): Promise<DevSessionResult> {
  // Every new bundle process gets its own controller. This way we can cancel any previous one if a new change
  // is detected even when multiple events are triggered very quickly (which causes weird edge cases)
  const currentBundleController = new AbortController()
  bundleControllers.push(currentBundleController)

  if (currentBundleController.signal.aborted) return {status: 'aborted'}
  outputDebug('Bundling and uploading extensions', options.stdout)
  const bundleZipPath = joinPath(dirname(options.bundlePath), `bundle.zip`)

  // Generate app manifest in the bundle folder (overwriting the previous one)
  const appManifest = await options.app.manifest()
  const manifestPath = joinPath(options.bundlePath, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(appManifest, null, 2))

  // Create zip file with everything
  if (currentBundleController.signal.aborted) return {status: 'aborted'}
  await zip({
    inputDirectory: options.bundlePath,
    outputZipPath: bundleZipPath,
  })

  // Get a signed URL to upload the zip file
  if (currentBundleController.signal.aborted) return {status: 'aborted'}
  const signedURL = await getSignedURLWithRetry(options)

  // Upload the zip file
  if (currentBundleController.signal.aborted) return {status: 'aborted'}
  const form = formData()
  const buffer = readFileSync(bundleZipPath)
  form.append('my_upload', buffer)
  await fetch(
    signedURL,
    {
      method: 'put',
      body: buffer,
      headers: form.getHeaders(),
    },
    'slow-request',
  )

  const payload: DevSessionPayload = {shopFqdn: options.storeFqdn, appId: options.appId, assetsUrl: signedURL}

  // Create or update the dev session
  if (currentBundleController.signal.aborted) return {status: 'aborted'}
  try {
    if (options.devSessionStatusManager.status.isReady) {
      const result = await devSessionUpdateWithRetry(payload, options.developerPlatformClient)
      const errors = result.devSessionUpdate?.userErrors ?? []
      if (errors.length) return {status: 'remote-error', error: errors}
      return {status: 'updated'}
    } else {
      const result = await devSessionCreateWithRetry(payload, options.developerPlatformClient)
      const errors = result.devSessionCreate?.userErrors ?? []
      if (errors.length) return {status: 'remote-error', error: errors}
      return {status: 'created'}
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.statusCode === 401) {
      throw new Error('Unauthorized')
    } else if (error instanceof ClientError) {
      if (error.response.status === 401 || error.response.status === 403) {
        throw new AbortError('Auth session expired. Please run `shopify app dev` again.')
      } else {
        outputDebug(JSON.stringify(error.response, null, 2), options.stdout)
        throw new AbortError('Unknown error')
      }
    } else {
      return {status: 'unknown-error', error}
    }
  }
}

async function getSignedURLWithRetry(options: DevSessionProcessOptions) {
  return performActionWithRetryAfterRecovery(
    async () =>
      getExtensionUploadURL(options.developerPlatformClient, {
        apiKey: options.appId,
        organizationId: options.organizationId,
        id: options.appId,
      }),
    () => options.developerPlatformClient.refreshToken(),
  )
}

async function devSessionUpdateWithRetry(payload: DevSessionPayload, developerPlatformClient: DeveloperPlatformClient) {
  return performActionWithRetryAfterRecovery(
    async () => developerPlatformClient.devSessionUpdate(payload),
    () => developerPlatformClient.refreshToken(),
  )
}

// If the Dev Session Create fails, we try to refresh the token and retry the operation
// This only happens if an error is thrown. Won't be triggered if we receive an error inside the response.
async function devSessionCreateWithRetry(payload: DevSessionPayload, developerPlatformClient: DeveloperPlatformClient) {
  return performActionWithRetryAfterRecovery(
    async () => developerPlatformClient.devSessionCreate(payload),
    () => developerPlatformClient.refreshToken(),
  )
}

async function updatePreviewURL(options: DevSessionProcessOptions, event: AppEvent) {
  const hasPreview = event.app.allExtensions.filter((ext) => ext.isPreviewable).length > 0
  const newPreviewURL = hasPreview ? options.appLocalProxyURL : options.appPreviewURL
  options.devSessionStatusManager.updateStatus({previewURL: newPreviewURL})
}

async function setUpdatedStatusMessage(options: DevSessionProcessOptions) {
  options.devSessionStatusManager.setMessage('UPDATED')

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setTimeout(async () => {
    // Reset the status message after 2 seconds
    if (options.devSessionStatusManager.status.statusMessage?.message === 'Updated') {
      options.devSessionStatusManager.setMessage('READY')
    }
  }, 2000)
}
