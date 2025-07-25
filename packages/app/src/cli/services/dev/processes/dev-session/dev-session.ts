import {DevSessionLogger} from './dev-session-logger.js'
import {DevSessionStatusManager} from './dev-session-status-manager.js'
import {DevSessionProcessOptions} from './dev-session-process.js'
import {AppEvent, AppEventWatcher, ExtensionEvent} from '../../app-events/app-event-watcher.js'
import {compressBundle, getUploadURL, uploadToGCS, writeManifestToBundle} from '../../../bundle.js'
import {DevSessionCreateOptions, DevSessionUpdateOptions} from '../../../../utilities/developer-platform-client.js'
import {AppManifest} from '../../../../models/app/app.js'
import {endHRTimeInMs, startHRTime} from '@shopify/cli-kit/node/hrtime'
import {ClientError} from 'graphql-request'
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {AbortError} from '@shopify/cli-kit/node/error'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {readdir} from '@shopify/cli-kit/node/fs'
import {SerialBatchProcessor} from '@shopify/cli-kit/node/serial-batch-processor'
import {Writable} from 'stream'

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
  private readonly appEventsProcessor: SerialBatchProcessor<AppEvent>
  private failedEvents: AppEvent[] = []

  private constructor(processOptions: DevSessionProcessOptions, stdout: Writable) {
    this.statusManager = processOptions.devSessionStatusManager
    this.logger = new DevSessionLogger(stdout)
    this.options = processOptions
    this.appWatcher = processOptions.appWatcher
    this.bundlePath = processOptions.appWatcher.buildOutputPath
    this.appEventsProcessor = new SerialBatchProcessor((events: AppEvent[]) => this.processEvents(events))
  }

  private async start() {
    await this.logger.info(`Preparing app preview on ${this.options.storeFqdn}`)
    this.statusManager.setMessage('LOADING')

    this.appWatcher
      .onEvent(async (event) => this.onEvent(event))
      .onStart(async (event) => this.onStart(event))
      .onError(async (error) => this.handleDevSessionResult({status: 'unknown-error', error}))
  }

  /**
   * Handle the app event, after validating the event it might trigger a dev session update.
   * If an update is already in progress, it will queue the event to be processed after
   * the current update completes.
   * @param event - The app event
   */
  private async onEvent(event: AppEvent) {
    const eventIsValid = await this.validateAppEvent(event)
    if (!eventIsValid) return

    this.appEventsProcessor.enqueue(event)
  }

  /**
   * Process an app event by bundling extensions and uploading them.
   * After completion, it will check if there are any pending events in the queue,
   * consolidate them into a single event, and process it.
   * @param event - The app event to process
   */
  private async processEvents(events: AppEvent[]) {
    // Include any previously failed events to be processed again
    const allEvents = [...this.failedEvents, ...events]
    const event = this.consolidateAppEvents(allEvents)
    this.failedEvents = []
    if (!event) return

    this.statusManager.setMessage('CHANGE_DETECTED')
    this.updatePreviewURL(event)
    await this.logger.logExtensionEvents(event)

    const networkStartTime = startHRTime()
    const result = await this.bundleExtensionsAndUpload(event)
    await this.handleDevSessionResult(result, event)
    await this.logger.debug(
      `✅ Event handled [Network: ${endHRTimeInMs(networkStartTime)}ms - Total: ${endHRTimeInMs(event.startTime)}ms]`,
    )
  }

  /**
   * Consolidate multiple app events into a single app event.
   * Takes the app from the latest event and merges extension events from all events.
   * @param events - Array of app events to consolidate
   * @returns A consolidated app event
   */
  private consolidateAppEvents(events: AppEvent[]): AppEvent | undefined {
    if (events.length === 0) return undefined
    if (events.length === 1) return events[0]

    const firstEvent = events[0]
    const lastEvent = events[events.length - 1]

    if (!firstEvent || !lastEvent) return undefined

    const allExtensionEvents = new Map<string, ExtensionEvent>()

    // Process all events from oldest to newest to get the latest state of each extension

    // The latest event has priority over the previous ones always, examples:
    // - created/updated and then deleted, keep deleted, the extension won't be included in the manifest.
    // - updated multiple times, keep the latest one, as they are technically the same event.
    // - created and then updated, keep the updated event, the manifest is the same in both cases.
    // - deleted and then created/updated, keep the created/updated event.
    for (const event of events) {
      for (const extensionEvent of event.extensionEvents) {
        allExtensionEvents.set(extensionEvent.extension.uid, extensionEvent)
      }
    }

    const consolidatedEvent: AppEvent = {
      app: lastEvent.app,
      path: lastEvent.path,
      extensionEvents: Array.from(allExtensionEvents.values()),
      startTime: firstEvent.startTime,
      appWasReloaded: events.some((event) => event.appWasReloaded),
    }

    return consolidatedEvent
  }

  /**
   * Handle the start of the dev session. It will create the dev session if there are no errors in the extensions.
   * @param event - The app event
   */
  private async onStart(event: AppEvent) {
    const errors = this.parseBuildErrors(event)
    if (errors.length) {
      await this.logger.logMultipleErrors(errors)
      throw new AbortError('App preview aborted, build errors detected in extensions')
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
   * Handle the result of the dev session
   * It basically logs the result and updates the status message.
   * @param result - The result of the dev session
   * @param event - The app event
   */
  private async handleDevSessionResult(result: DevSessionResult, event?: AppEvent) {
    if (result.status === 'updated') {
      await this.logger.success(`✅ Updated app preview on ${this.options.storeFqdn}`)
      await this.logger.logExtensionUpdateMessages(event)
      await this.setUpdatedStatusMessage()
    } else if (result.status === 'created') {
      this.statusManager.updateStatus({isReady: true})
      await this.logger.success(`✅ Ready, watching for changes in your app `)
      await this.logger.logExtensionUpdateMessages(event)
      this.statusManager.setMessage('READY')
    } else if (result.status === 'aborted') {
      await this.logger.debug('❌ App preview update aborted (new change detected or error during update)')
    } else if (result.status === 'remote-error' || result.status === 'unknown-error') {
      await this.logger.logUserErrors(result.error, event?.app.allExtensions ?? [])
      if (result.error instanceof Error && result.error.cause === 'validation-error') {
        this.statusManager.setMessage('VALIDATION_ERROR')
      } else {
        if (event) this.failedEvents.push(event)
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
  private updatePreviewURL(event: AppEvent) {
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
    try {
      const {manifest, inheritedModuleUids, assets} = await this.createManifest(appEvent)
      const signedURL = await this.uploadAssetsIfNeeded(assets, !this.statusManager.status.isReady)

      const payload = {
        shopFqdn: this.options.storeFqdn,
        appId: this.options.appId,
        assetsUrl: signedURL,
        manifest,
        inheritedModuleUids,
      }
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
   * Create a manifest for the dev session
   * It will only include the extensions that have been updated. (or all extensions when creating a new session)
   * @param appEvent - The app event
   * @returns The manifest and the inherited module uids
   */
  private async createManifest(
    appEvent: AppEvent,
  ): Promise<{manifest: AppManifest; inheritedModuleUids: string[]; assets: string[]}> {
    const updatedUids = appEvent.extensionEvents
      .filter((event) => event.type !== 'deleted')
      .map((event) => event.extension.uid)

    const nonUpdatedUids = appEvent.app.allExtensions
      .filter((ext) => !updatedUids.includes(ext.uid))
      .map((ext) => ext.uid)

    const appManifest = await appEvent.app.manifest(undefined)

    // Only use inherited for UPDATE session. Create still needs the manifest in the bundle.
    if (this.statusManager.status.isReady) {
      appManifest.modules = appManifest.modules.filter((module) => updatedUids.includes(module.uid))
    } else {
      await writeManifestToBundle(appEvent.app, this.bundlePath, undefined)
    }

    const existingDirs = await readdir(this.bundlePath)
    const assets = appManifest.modules
      .map((module) => module.assets)
      .filter((assetPath) => existingDirs.includes(assetPath))

    return {manifest: appManifest, inheritedModuleUids: nonUpdatedUids, assets}
  }

  /**
   * Upload the assets if needed
   * If the affected modules in the manifest don't have any assets, we don't need to upload anything.
   * @param assets - The list of asset folders to upload
   * @param bundleController - abortController to abort the bundle process if a new change is detected
   * @returns The signed URL if we uploaded any assets, otherwise undefined
   */
  private async uploadAssetsIfNeeded(assets: string[], includeManifest: boolean): Promise<string | undefined> {
    if (!assets.length && !includeManifest) return undefined
    const compressedBundlePath = joinPath(
      dirname(this.bundlePath),
      `dev-bundle.${this.options.developerPlatformClient.bundleFormat}`,
    )

    // Create zip file with everything
    const filePattern = [...assets.map((ext) => `${ext}/**`), '!**/*.js.map']
    if (includeManifest) filePattern.push('manifest.json')

    await compressBundle(this.bundlePath, compressedBundlePath, filePattern)

    // Get a signed URL to upload the zip file
    const signedURL = await this.getSignedURLWithRetry()

    // Upload the zip file
    await uploadToGCS(signedURL, compressedBundlePath)
    return signedURL
  }

  /**
   * Get a signed URL to upload the zip file to GCS
   * @returns The signed URL
   */
  private async getSignedURLWithRetry() {
    return getUploadURL(this.options.developerPlatformClient, {
      apiKey: this.options.appId,
      organizationId: this.options.organizationId,
      id: this.options.appId,
    })
  }

  /**
   * Update the dev session
   * @param payload - The payload to update the dev session with
   */
  private async devSessionUpdateWithRetry(payload: DevSessionUpdateOptions): Promise<DevSessionResult> {
    const result = await this.options.developerPlatformClient.devSessionUpdate(payload)
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
  private async devSessionCreateWithRetry(payload: DevSessionCreateOptions): Promise<DevSessionResult> {
    const result = await this.options.developerPlatformClient.devSessionCreate(payload)
    const errors = result.devSessionCreate?.userErrors ?? []
    if (errors.length) return {status: 'remote-error', error: errors}
    return {status: 'created'}
  }
}
