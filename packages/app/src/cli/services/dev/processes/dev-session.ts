import {BaseProcess, DevProcessFunction} from './types.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {getExtensionUploadURL} from '../../deploy/upload.js'
import {AppEvent, AppEventWatcher} from '../app-events/app-event-watcher.js'
import {buildAppURLForWeb} from '../../../utilities/app/app-url.js'
import {readFileSync, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {zip} from '@shopify/cli-kit/node/archiver'
import {formData, fetch} from '@shopify/cli-kit/node/http'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {endHRTimeInMs, startHRTime} from '@shopify/cli-kit/node/hrtime'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {AbortError} from '@shopify/cli-kit/node/error'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
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

interface UserError {
  message: string
  on: JsonMapType
  field?: string[] | null
  category: string
}

type DevSessionResult =
  | {status: 'updated' | 'created' | 'aborted'}
  | {status: 'remote-error'; error: UserError[]}
  | {status: 'unknown-error'; error: Error}

let bundleControllers: AbortController[] = []

// Current status of the dev session
// Since the watcher can emit events before the dev session is ready, we need to keep track of the status
let isDevSessionReady = false

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
  const {developerPlatformClient, appWatcher} = options

  isDevSessionReady = false
  const refreshToken = async () => {
    return developerPlatformClient.refreshToken()
  }

  const processOptions = {...options, stderr, stdout, signal, bundlePath: appWatcher.buildOutputPath}

  await printLogMessage('Preparing dev session', processOptions.stdout)

  appWatcher
    .onEvent(async (event) => {
      if (!isDevSessionReady) {
        await printWarning('Change detected, but dev session is not ready yet.', processOptions.stdout)
        return
      }

      // If there are any errors build errors, don't update the dev session
      const anyError = event.extensionEvents.some((eve) => eve.buildResult?.status === 'error')
      if (anyError) return

      // Cancel any ongoing bundle and upload process
      bundleControllers.forEach((controller) => controller.abort())
      // Remove aborted controllers from array:
      bundleControllers = bundleControllers.filter((controller) => !controller.signal.aborted)

      // For each extension event, print a message to the terminal
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      event.extensionEvents.forEach(async (eve) => {
        const outputPrefix = eve.extension.isAppConfigExtension ? 'app-config' : eve.extension.handle
        const message = `${eve.extension.isAppConfigExtension ? 'App config' : 'Extension'} ${eve.type}`
        await useConcurrentOutputContext({outputPrefix, stripAnsi: false}, () => processOptions.stdout.write(message))
      })

      const networkStartTime = startHRTime()
      await performActionWithRetryAfterRecovery(async () => {
        const result = await bundleExtensionsAndUpload({...processOptions, app: event.app})
        await handleDevSessionResult(result, {...processOptions, app: event.app}, event)
        const endTime = endHRTimeInMs(event.startTime)
        const endNetworkTime = endHRTimeInMs(networkStartTime)
        outputDebug(`✅ Event handled [Network: ${endNetworkTime}ms -- Total: ${endTime}ms]`, processOptions.stdout)
      }, refreshToken)
    })
    .onStart(async (event) => {
      await performActionWithRetryAfterRecovery(async () => {
        const result = await bundleExtensionsAndUpload({...processOptions, app: event.app})
        await handleDevSessionResult(result, {...processOptions, app: event.app})
      }, refreshToken)
    })
}

async function handleDevSessionResult(
  result: DevSessionResult,
  processOptions: DevSessionProcessOptions,
  event?: AppEvent,
) {
  if (result.status === 'updated') {
    await printSuccess(`✅ Updated`, processOptions.stdout)
    const scopeChanges = event?.extensionEvents.find((eve) => eve.extension.handle === 'app-access')
    if (scopeChanges) {
      await printWarning(`🔄 Action required`, processOptions.stdout)
      const scopesURL = await buildAppURLForWeb(processOptions.storeFqdn, processOptions.apiKey)
      const message = outputContent`└  Scopes updated. ${outputToken.link('Open app to accept scopes.', scopesURL)}`
      await printWarning(message.value, processOptions.stdout)
    }
  } else if (result.status === 'created') {
    isDevSessionReady = true
    await printSuccess(`✅ Ready, watching for changes in your app `, processOptions.stdout)
  } else if (result.status === 'aborted') {
    outputDebug('❌ Session update aborted (new change detected or error in Session Update)', processOptions.stdout)
  } else if (result.status === 'remote-error' || result.status === 'unknown-error') {
    await processUserErrors(result.error, processOptions, processOptions.stdout)
  }

  // If we failed to create a session, exit the process. Don't throw an error in tests as it can't be caught due to the
  // async nature of the process.
  if (!isDevSessionReady && !isUnitTest()) throw new AbortError('Failed to create dev session')
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
  const signedURL = await getExtensionUploadURL(options.developerPlatformClient, {
    apiKey: options.appId,
    organizationId: options.organizationId,
    id: options.appId,
  })

  // Upload the zip file
  if (currentBundleController.signal.aborted) return {status: 'aborted'}
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
  if (currentBundleController.signal.aborted) return {status: 'aborted'}
  try {
    if (isDevSessionReady) {
      const result = await options.developerPlatformClient.devSessionUpdate(payload)
      const errors = result.devSessionUpdate?.userErrors ?? []
      if (errors.length) return {status: 'remote-error', error: errors}
      return {status: 'updated'}
    } else {
      const result = await options.developerPlatformClient.devSessionCreate(payload)
      const errors = result.devSessionCreate?.userErrors ?? []
      if (errors.length) return {status: 'remote-error', error: errors}
      return {status: 'created'}
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.statusCode === 401) {
      // Re-throw the error so the recovery procedure can be executed
      throw new Error('Unauthorized')
    } else {
      return {status: 'unknown-error', error}
    }
  }
}

async function processUserErrors(
  errors: UserError[] | Error | string,
  options: DevSessionProcessOptions,
  stdout: Writable,
) {
  if (typeof errors === 'string') {
    await printError(errors, stdout)
  } else if (errors instanceof Error) {
    await printError(errors.message, stdout)
  } else {
    for (const error of errors) {
      const on = error.on ? (error.on[0] as {user_identifier: unknown}) : undefined
      // If we have information about the extension that caused the error, use the handle as prefix in the output.
      const extension = options.app.allExtensions.find((ext) => ext.uid === on?.user_identifier)
      // eslint-disable-next-line no-await-in-loop
      await printError(error.message, stdout, extension?.handle ?? 'dev-session')
    }
  }
}

async function printWarning(message: string, stdout: Writable) {
  await printLogMessage(outputContent`${outputToken.yellow(message)}`.value, stdout)
}

async function printError(message: string, stdout: Writable, prefix?: string) {
  const header = outputToken.errorText(`❌ Error`)
  const content = outputToken.errorText(`└  ${message}`)
  await printLogMessage(outputContent`${header}`.value, stdout, prefix)
  await printLogMessage(outputContent`${content}`.value, stdout, prefix)
}

async function printSuccess(message: string, stdout: Writable) {
  await printLogMessage(outputContent`${outputToken.green(message)}`.value, stdout)
}

// Helper function to print to terminal using output context with stripAnsi disabled.
async function printLogMessage(message: string, stdout: Writable, prefix?: string) {
  await useConcurrentOutputContext({outputPrefix: prefix ?? 'dev-session', stripAnsi: false}, () => {
    stdout.write(message)
  })
}
