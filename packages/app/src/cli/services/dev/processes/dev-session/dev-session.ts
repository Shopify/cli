import {DevSessionLogger} from './dev-session-logger.js'
import {DevSessionStatusManager} from './dev-session-status-manager.js'
import {DevSessionProcessOptions} from './dev-session-process.js'
import {AppEvent, AppEventWatcher} from '../../app-events/app-event-watcher.js'
import {compressBundle, getUploadURL, uploadToGCS, writeManifestToBundle} from '../../../bundle.js'
import {endHRTimeInMs, startHRTime} from '@shopify/cli-kit/node/hrtime'
import {ClientError} from 'graphql-request'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {AbortError} from '@shopify/cli-kit/node/error'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
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
  private readonly bundlePath: string
  private bundleControllers: AbortController[] = []

  private constructor(processOptions: DevSessionProcessOptions, stdout: Writable) {
    this.statusManager = processOptions.devSessionStatusManager
    this.logger = new DevSessionLogger(stdout)
    this.options = processOptions
    this.appWatcher = processOptions.appWatcher
    this.bundlePath = processOptions.appWatcher.buildOutputPath
  }

  private async start() {
    await this.logger.info('Preparing app preview')
    this.statusManager.setMessage('LOADING')

    this.appWatcher
      .onEvent(async (event) => this.onEvent(event))
      .onStart(async (event) => this.onStart(event))
      .onError(async (error) => this.handleDevSessionResult({status: 'unknown-error', error}))
  }

  /**
   * Handle the app event, after validating the event it might trigger a dev session update.
   * @param event - The app event
   */
  private async onEvent(event: AppEvent) {
    const eventIsValid = await this.validateAppEvent(event)
    if (!eventIsValid) return
    this.abortPreviousOngoingUpdates()
    this.statusManager.setMessage('CHANGE_DETECTED')
    await this.updatePreviewURL(event)
    await this.logger.logExtensionEvents(event)

    const networkStartTime = startHRTime()
    const result = await this.bundleExtensionsAndUpload(event)
    await this.handleDevSessionResult(result, event)
    await this.logger.debug(
      `✅ Event handled [Network: ${endHRTimeInMs(networkStartTime)}ms - Total: ${endHRTimeInMs(event.startTime)}ms]`,
    )
  }

  /**
   * Handle the start of the dev session. It will create the dev session if there are no errors in the extensions.
   * @param event - The app event
   */
  private async onStart(event: AppEvent) {
    const errors = this.parseBuildErrors(event)
    if (errors.length) {
      await this.logger.logMultipleErrors(errors)
      throw new AbortError('App preview aborted, build errors detected in extensions.')
    }
    const result = await this.bundleExtensionsAndUpload(event)
    await this.handleDevSessionResult(result, event)
  }

  /**
   * Validate the app event: It checks if the event requires a new dev session update.
   * If the dev session is not ready, it will return false.
   * If there are build errors, it will return false.
   * If there are no extension events, it will return false.
   * Otherwise, it will return true.
   *
   * @param event - The app event
   * @returns Whether the app event is valid
   */
  private async validateAppEvent(event: AppEvent): Promise<boolean> {
    if (!this.statusManager.status.isReady) {
      await this.logger.warning('Change detected, but app preview is not ready yet.')
      return false
    }

    // If there are any build errors, don't update the dev session
    const errors = this.parseBuildErrors(event)
    if (errors.length) {
      await this.logger.logMultipleErrors(errors)
      this.statusManager.setMessage('BUILD_ERROR')
      return false
    }

    if (event.extensionEvents.length === 0) {
      // The app was probably reloaded, but no extensions were affected, we are ready for new changes.
      // But we shouldn't trigger a new dev session update in this case.
      this.statusManager.setMessage('READY')
      return false
    }

    return true
  }

  /**
   * Parse the build errors from the app event
   * @param event - The app event
   * @returns The build errors
   */
  private parseBuildErrors(event: AppEvent) {
    const buildErrors = event.extensionEvents.filter((eve) => eve.buildResult?.status === 'error')
    return buildErrors.map((error) => ({
      error: 'Build error. Please review your code and try again.',
      prefix: error.extension.handle,
    }))
  }

  /**
   * Abort any previous ongoing updates
   * If multiple changes are detected very quickly, this will abort the previous bundle and upload process
   * and only the last one will be completed.
   */
  private abortPreviousOngoingUpdates() {
    this.bundleControllers.forEach((controller) => controller.abort())
    this.bundleControllers = this.bundleControllers.filter((controller) => !controller.signal.aborted)
  }

  /**
   * Handle the result of the dev session
   * It basically logs the result and updates the status message.
   * @param result - The result of the dev session
   * @param event - The app event
   */
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
      await this.logger.debug('❌ App preview update aborted (new change detected or error during update)')
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
      throw new AbortError('Failed to start app preview.')
    }
  }

  /**
   * Update the preview URL, it only changes if we move between a non-previewable state and a previewable state.
   * (i.e. if we go from a state with no extensions to a state with ui-extensions or vice versa)
   * @param event - The app event
   */
  private async updatePreviewURL(event: AppEvent) {
    const hasPreview = event.app.allExtensions.filter((ext) => ext.isPreviewable).length > 0
    const newPreviewURL = hasPreview ? this.options.appLocalProxyURL : this.options.appPreviewURL
    this.statusManager.updateStatus({previewURL: newPreviewURL})
  }

  /**
   * Set the status message to 'UPDATED'
   * Reset the status message to 'READY' after 2 seconds
   */
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
    const bundleZipPath = joinPath(dirname(this.bundlePath), `dev-bundle.zip`)

    // Create zip file with everything
    if (currentBundleController.signal.aborted) return {status: 'aborted'}
    await writeManifestToBundle(appEvent.app, this.bundlePath)
    await compressBundle(this.bundlePath, bundleZipPath)
    try {
      // Get a signed URL to upload the zip file
      if (currentBundleController.signal.aborted) return {status: 'aborted'}
      const signedURL = await this.getSignedURLWithRetry()

      // Upload the zip file
      if (currentBundleController.signal.aborted) return {status: 'aborted'}
      await uploadToGCS(signedURL, bundleZipPath)
      // Create or update the dev session
      if (currentBundleController.signal.aborted) return {status: 'aborted'}
      const payload = {shopFqdn: this.options.storeFqdn, appId: this.options.appId, assetsUrl: signedURL}
      if (this.statusManager.status.isReady) {
        return this.devSessionUpdateWithRetry(payload)
      } else {
        return this.devSessionCreateWithRetry(payload)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.statusCode === 401) {
        throw new Error('Unauthorized')
      } else if (error instanceof ClientError) {
        if (error.response.status === 401 || error.response.status === 403) {
          throw new AbortError('Auth session expired. Please run `shopify app dev` again.')
        } else {
          await this.logger.debug(JSON.stringify(error.response, null, 2))
          throw new AbortError('Unknown error')
        }
      } else if (error.code === 'ETIMEDOUT') {
        return {
          status: 'unknown-error',
          error: new Error('Request timed out, please check your internet connection and try again.'),
        }
      } else {
        return {status: 'unknown-error', error}
      }
    }
  }

  /**
   * Get a signed URL to upload the zip file to GCS. If the request fails, we refresh the token and retry the operation.
   * @returns The signed URL
   */
  private async getSignedURLWithRetry() {
    return performActionWithRetryAfterRecovery(
      async () =>
        getUploadURL(this.options.developerPlatformClient, {
          apiKey: this.options.appId,
          organizationId: this.options.organizationId,
          id: this.options.appId,
        }),
      () => this.options.developerPlatformClient.refreshToken(),
    )
  }

  /**
   * Update the dev session
   * @param payload - The payload to update the dev session with
   */
  private async devSessionUpdateWithRetry(payload: DevSessionPayload): Promise<DevSessionResult> {
    const result = await performActionWithRetryAfterRecovery(
      async () => this.options.developerPlatformClient.devSessionUpdate(payload),
      () => this.options.developerPlatformClient.refreshToken(),
    )
    const errors = result.devSessionUpdate?.userErrors ?? []
    if (errors.length) return {status: 'remote-error', error: errors}
    return {status: 'updated'}
  }

  /**
   * Create the dev session
   * If the Dev Session Create fails, we try to refresh the token and retry the operation
   * This only happens if an error is thrown. Won't be triggered if we receive an error inside the response.
   * @param payload - The payload to create the dev session with
   */
  private async devSessionCreateWithRetry(payload: DevSessionPayload): Promise<DevSessionResult> {
    const result = await performActionWithRetryAfterRecovery(
      async () => this.options.developerPlatformClient.devSessionCreate(payload),
      () => this.options.developerPlatformClient.refreshToken(),
    )
    const errors = result.devSessionCreate?.userErrors ?? []
    if (errors.length) return {status: 'remote-error', error: errors}
    return {status: 'created'}
  }
}
