import {DevSessionLogger} from './dev-session-logger.js'
import {DevSessionStatusManager} from './dev-session-status-manager.js'
import {DevSessionProcessOptions} from './dev-session-process.js'
import {AppEvent, AppEventWatcher} from '../../app-events/app-event-watcher.js'
import {getExtensionUploadURL} from '../../../deploy/upload.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {endHRTimeInMs, startHRTime} from '@shopify/cli-kit/node/hrtime'
import {ClientError} from 'graphql-request'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {AbortError} from '@shopify/cli-kit/node/error'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {readFileSync, writeFile} from '@shopify/cli-kit/node/fs'
import {zip} from '@shopify/cli-kit/node/archiver'
import {formData, fetch} from '@shopify/cli-kit/node/http'
import {Writable} from 'stream'

interface DevSessionPayload {
  shopFqdn: string
  appId: string
  assetsUrl: string
}

export interface UserError {
  message: string
  on: JsonMapType
  field?: string[] | null
  category: string
}

type DevSessionResult =
  | {status: 'updated' | 'created' | 'aborted'}
  | {status: 'remote-error'; error: UserError[]}
  | {status: 'unknown-error'; error: Error}

export class DevSession {
  public static async start(options: DevSessionProcessOptions, stdout: Writable): Promise<DevSession> {
    const devSession = new DevSession(options, stdout)
    await devSession.start()
    return devSession
  }

  private readonly statusManager: DevSessionStatusManager
  private readonly logger: DevSessionLogger
  private readonly options: DevSessionProcessOptions
  private readonly appWatcher: AppEventWatcher
  private readonly stdout: Writable
  private readonly bundlePath: string
  private bundleControllers: AbortController[] = []

  private constructor(processOptions: DevSessionProcessOptions, stdout: Writable) {
    this.statusManager = processOptions.devSessionStatusManager
    this.logger = new DevSessionLogger(stdout)
    this.options = processOptions
    this.appWatcher = processOptions.appWatcher
    this.stdout = stdout
    this.bundlePath = processOptions.appWatcher.buildOutputPath
  }

  private async start() {
    await this.logger.info('Preparing dev session')
    this.statusManager.setMessage('LOADING')

    this.appWatcher
      .onEvent(async (event) => this.onEvent(event))
      .onStart(async (event) => this.onStart(event))
      .onError(async (error) => this.handleDevSessionResult({status: 'unknown-error', error}))
  }

  private async onEvent(event: AppEvent) {
    if (!this.statusManager.status.isReady) {
      await this.logger.warning('Change detected, but dev session is not ready yet.')
      return
    }

    // If there are any build errors, don't update the dev session
    const anyError = event.extensionEvents.some((eve) => eve.buildResult?.status === 'error')
    if (anyError) return this.statusManager.setMessage('BUILD_ERROR')

    if (event.extensionEvents.length === 0) {
      // The app was probably reloaded, but no extensions were affected, we are ready for new changes.
      // But we shouldn't trigger a new dev session update in this case.
      this.statusManager.setMessage('READY')
      return
    }

    this.statusManager.setMessage('CHANGE_DETECTED')

    await this.updatePreviewURL(event)

    // Cancel any ongoing bundle and upload process
    this.bundleControllers.forEach((controller) => controller.abort())
    // Remove aborted controllers from array:
    this.bundleControllers = this.bundleControllers.filter((controller) => !controller.signal.aborted)

    await this.logger.logExtensionEvents(event)

    const networkStartTime = startHRTime()
    const result = await this.bundleExtensionsAndUpload(event)
    await this.handleDevSessionResult(result, event)
    outputDebug(
      `✅ Event handled [Network: ${endHRTimeInMs(networkStartTime)}ms - Total: ${endHRTimeInMs(event.startTime)}ms]`,
      this.stdout,
    )
  }

  private async onStart(event: AppEvent) {
    const buildErrors = event.extensionEvents.filter((eve) => eve.buildResult?.status === 'error')
    if (buildErrors.length) {
      const errors = buildErrors.map((error) => ({
        error: 'Build error. Please review your code and try again.',
        prefix: error.extension.handle,
      }))
      await this.logger.logMultipleErrors(errors)
      throw new AbortError('Dev session aborted, build errors detected in extensions.')
    }
    const result = await this.bundleExtensionsAndUpload(event)
    await this.handleDevSessionResult(result, event)
  }

  private async handleDevSessionResult(result: DevSessionResult, event?: AppEvent) {
    if (result.status === 'updated') {
      await this.logger.success(`✅ Updated`)
      await this.logger.logActionRequiredMessages(this.options.storeFqdn, event)
      await this.setUpdatedStatusMessage()
    } else if (result.status === 'created') {
      this.statusManager.updateStatus({isReady: true})
      await this.logger.success(`✅ Ready, watching for changes in your app `)
      this.statusManager.setMessage('READY')
    } else if (result.status === 'aborted') {
      outputDebug('❌ Session update aborted (new change detected or error in Session Update)', this.stdout)
    } else if (result.status === 'remote-error' || result.status === 'unknown-error') {
      await this.logger.logUserErrors(result.error, event?.app.allExtensions ?? [])
      if (result.error instanceof Error && result.error.cause === 'validation-error') {
        this.statusManager.setMessage('VALIDATION_ERROR')
      } else {
        this.statusManager.setMessage('REMOTE_ERROR')
      }
    }

    // If we failed to create a session, exit the process. Don't throw an error in tests as it can't be caught due to the
    // async nature of the process.
    if (!this.statusManager.status.isReady && !isUnitTest()) {
      throw new AbortError('Failed to start dev session.')
    }
  }

  private async updatePreviewURL(event: AppEvent) {
    const hasPreview = event.app.allExtensions.filter((ext) => ext.isPreviewable).length > 0
    const newPreviewURL = hasPreview ? this.options.appLocalProxyURL : this.options.appPreviewURL
    this.statusManager.updateStatus({previewURL: newPreviewURL})
  }

  private async setUpdatedStatusMessage() {
    this.statusManager.setMessage('UPDATED')

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(async () => {
      // Reset the status message after 2 seconds
      if (this.statusManager.status.statusMessage?.message === 'Updated') {
        this.statusManager.setMessage('READY')
      }
    }, 2000)
  }

  /**
   * Bundle all extensions and upload them to the developer platform
   * Generate a new manifest in the bundle folder, zip it and upload it to GCS.
   * Then create or update the dev session with the new assets URL.
   *
   * @param options - The options for the process
   * @param updating - Whether the dev session is being updated or created
   */
  private async bundleExtensionsAndUpload(appEvent: AppEvent): Promise<DevSessionResult> {
    // Every new bundle process gets its own controller. This way we can cancel any previous one if a new change
    // is detected even when multiple events are triggered very quickly (which causes weird edge cases)
    const currentBundleController = new AbortController()
    this.bundleControllers.push(currentBundleController)

    if (currentBundleController.signal.aborted) return {status: 'aborted'}
    outputDebug('Bundling and uploading extensions', this.stdout)
    const bundleZipPath = joinPath(dirname(this.bundlePath), `bundle.zip`)

    // Generate app manifest in the bundle folder (overwriting the previous one)
    const appManifest = await appEvent.app.manifest()
    const manifestPath = joinPath(this.bundlePath, 'manifest.json')
    await writeFile(manifestPath, JSON.stringify(appManifest, null, 2))

    // Create zip file with everything
    if (currentBundleController.signal.aborted) return {status: 'aborted'}
    await zip({
      inputDirectory: this.bundlePath,
      outputZipPath: bundleZipPath,
    })

    // Get a signed URL to upload the zip file
    if (currentBundleController.signal.aborted) return {status: 'aborted'}
    const signedURL = await this.getSignedURLWithRetry()

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

    const payload: DevSessionPayload = {
      shopFqdn: this.options.storeFqdn,
      appId: this.options.appId,
      assetsUrl: signedURL,
    }

    // Create or update the dev session
    if (currentBundleController.signal.aborted) return {status: 'aborted'}
    try {
      if (this.statusManager.status.isReady) {
        const result = await this.devSessionUpdateWithRetry(payload)
        const errors = result.devSessionUpdate?.userErrors ?? []
        if (errors.length) return {status: 'remote-error', error: errors}
        return {status: 'updated'}
      } else {
        const result = await this.devSessionCreateWithRetry(payload)
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
          outputDebug(JSON.stringify(error.response, null, 2), this.stdout)
          throw new AbortError('Unknown error')
        }
      } else {
        return {status: 'unknown-error', error}
      }
    }
  }

  private async getSignedURLWithRetry() {
    return performActionWithRetryAfterRecovery(
      async () =>
        getExtensionUploadURL(this.options.developerPlatformClient, {
          apiKey: this.options.appId,
          organizationId: this.options.organizationId,
          id: this.options.appId,
        }),
      () => this.options.developerPlatformClient.refreshToken(),
    )
  }

  private async devSessionUpdateWithRetry(payload: DevSessionPayload) {
    return performActionWithRetryAfterRecovery(
      async () => this.options.developerPlatformClient.devSessionUpdate(payload),
      () => this.options.developerPlatformClient.refreshToken(),
    )
  }

  // If the Dev Session Create fails, we try to refresh the token and retry the operation
  // This only happens if an error is thrown. Won't be triggered if we receive an error inside the response.
  private async devSessionCreateWithRetry(payload: DevSessionPayload) {
    return performActionWithRetryAfterRecovery(
      async () => this.options.developerPlatformClient.devSessionCreate(payload),
      () => this.options.developerPlatformClient.refreshToken(),
    )
  }
}
