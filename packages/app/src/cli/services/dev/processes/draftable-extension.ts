import {BaseProcess, DevProcessFunction} from './types.js'
import {updateExtensionDraft} from '../update-extension.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {AppInterface} from '../../../models/app/app.js'
import {PartnersAppForIdentifierMatching, ensureDeploymentIdsPresence} from '../../context/identifiers.js'
import {getAppIdentifiers} from '../../../models/app/identifiers.js'
import {installJavy} from '../../function/build.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppEventWatcher, EventType} from '../app-events/app-event-watcher.js'
import {ExtensionBuildOptions} from '../../build/extension.js'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AbortController} from '@shopify/cli-kit/node/abort'

interface DraftableExtensionOptions {
  extensions: ExtensionInstance[]
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  remoteExtensionIds: {[key: string]: string}
  proxyUrl: string
  localApp: AppInterface
  appWatcher: AppEventWatcher
}

export interface DraftableExtensionProcess extends BaseProcess<DraftableExtensionOptions> {
  type: 'draftable-extension'
}

export const pushUpdatesForDraftableExtensions: DevProcessFunction<DraftableExtensionOptions> = async (
  {stderr, stdout},
  {developerPlatformClient, apiKey, remoteExtensionIds: remoteExtensions, proxyUrl, localApp: app, appWatcher},
) => {
  // Force the download of the javy binary in advance to avoid later problems,
  // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
  await installJavy(app)

  async function refreshToken() {
    await developerPlatformClient.refreshToken()
  }

  const buildOptions: ExtensionBuildOptions = {
    app,
    stdout,
    stderr,
    useTasks: false,
    environment: 'development',
    appURL: proxyUrl,
  }
  const buildControllers: {[key: string]: AbortController | null} = {}

  // Build the extension and cancel any previous build if it's still running.
  async function buildExtension(extension: ExtensionInstance) {
    let buildController = buildControllers[extension.handle]
    if (buildController) buildController.abort()
    buildController = new AbortController()
    buildControllers[extension.handle] = buildController
    if (!buildController.signal.aborted) {
      console.log('BUILD')
      return extension.build({...buildOptions, signal: buildController.signal})
    }
  }

  const draftableHandles = app.draftableExtensions.map((extension) => extension.handle)

  appWatcher.onEvent(async (event) => {
    for (const {type, extension} of event.extensionEvents) {
      const registrationId = remoteExtensions[extension.localIdentifier]
      if (!registrationId) throw new AbortError(`Extension ${extension.localIdentifier} not found on remote app.`)
      // Create and Delete events are ignored in this version of the `dev` command.
      if (type === EventType.Created || type === EventType.Deleted) continue
      // Ignore events for non-draftable extensions
      if (!draftableHandles.includes(extension.handle)) continue
      if (type === EventType.UpdatedSourceFile) {
        // eslint-disable-next-line no-await-in-loop
        await buildExtension(extension)
      }

      // eslint-disable-next-line no-await-in-loop
      await performActionWithRetryAfterRecovery(
        async () =>
          updateExtensionDraft({
            extension,
            developerPlatformClient,
            apiKey,
            registrationId,
            stdout,
            stderr,
            appConfiguration: app.configuration,
          }),
        refreshToken,
      )
    }
  })

  // await Promise.all(
  //   extensions.map(async (extension) => {
  //     return useConcurrentOutputContext({outputPrefix: extension.outputPrefix}, async () => {
  //       await extension.build(buildOptions)
  //       const registrationId = remoteExtensions[extension.localIdentifier]
  //       if (!registrationId) throw new AbortError(`Extension ${extension.localIdentifier} not found on remote app.`)
  //       // Initial draft update for each extension
  //       await updateExtensionDraft({
  //         extension,
  //         developerPlatformClient,
  //         apiKey,
  //         registrationId,
  //         stdout,
  //         stderr,
  //         appConfiguration: app.configuration,
  //       })
  //       // Watch for changes
  //       return setupExtensionWatcher({
  //         extension,
  //         app,
  //         url: proxyUrl,
  //         stdout,
  //         stderr,
  //         signal,
  //         onChange: async () => {
  //           // At this point the extension has already been built and is ready to be updated
  //           return performActionWithRetryAfterRecovery(
  //             async () =>
  //               updateExtensionDraft({
  //                 extension,
  //                 developerPlatformClient,
  //                 apiKey,
  //                 registrationId,
  //                 stdout,
  //                 stderr,
  //                 appConfiguration: app.configuration,
  //               }),
  //             refreshToken,
  //           )
  //         },
  //         onReloadAndBuildError: async (error) => {
  //           const draftUpdateErrorMessage = extension.draftMessages.errorMessage
  //           if (draftUpdateErrorMessage) {
  //             outputWarn(`${draftUpdateErrorMessage}: ${error.message}`, stdout)
  //           }
  //         },
  //       })
  //     })
  //   }),
  // )
}

export async function setupDraftableExtensionsProcess({
  localApp,
  apiKey,
  developerPlatformClient,
  remoteApp,
  ...options
}: Omit<DraftableExtensionOptions, 'remoteExtensionIds' | 'extensions'> & {
  remoteApp: PartnersAppForIdentifierMatching
}): Promise<DraftableExtensionProcess | undefined> {
  const draftableExtensions = localApp.draftableExtensions
  if (draftableExtensions.length === 0) {
    return
  }

  const prodEnvIdentifiers = getAppIdentifiers({app: localApp}, developerPlatformClient)

  const {extensionIds: remoteExtensionIds, extensions: extensionsUuids} = await ensureDeploymentIdsPresence({
    app: localApp,
    remoteApp,
    appId: apiKey,
    appName: remoteApp.title,
    force: true,
    release: true,
    developerPlatformClient,
    envIdentifiers: prodEnvIdentifiers,
    includeDraftExtensions: true,
  })

  // Update the local app with the remote extension UUIDs.
  // Extensions are initialized with a random dev UUID when running the dev command
  // which is sent over WS messages for live reload in dev preview of UI Extensions.
  localApp.updateExtensionUUIDS(extensionsUuids)

  return {
    type: 'draftable-extension',
    prefix: 'extensions',
    function: pushUpdatesForDraftableExtensions,
    options: {
      localApp,
      apiKey,
      developerPlatformClient,
      ...options,
      extensions: draftableExtensions,
      remoteExtensionIds,
    },
  }
}
