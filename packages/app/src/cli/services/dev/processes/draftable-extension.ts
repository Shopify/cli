import {BaseProcess, DevProcessFunction} from './types.js'
import {updateExtensionDraft} from '../update-extension.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {AppInterface} from '../../../models/app/app.js'
import {PartnersAppForIdentifierMatching, ensureDeploymentIdsPresence} from '../../context/identifiers.js'
import {getAppIdentifiers} from '../../../models/app/identifiers.js'
import {installJavy} from '../../function/build.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppEventWatcher, EventType} from '../app-events/app-event-watcher.js'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'

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
  {developerPlatformClient, apiKey, remoteExtensionIds: remoteExtensions, localApp: app, appWatcher},
) => {
  // Force the download of the javy binary in advance to avoid later problems,
  // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
  await installJavy(app)

  async function refreshToken() {
    await developerPlatformClient.refreshToken()
  }

  appWatcher.onEvent(async (event) => {
    const extEvents = event.extensionEvents.filter(
      (extEvent) => extEvent.type !== EventType.Deleted && event.app.draftableExtensions.includes(extEvent.extension),
    )
    const promises = extEvents.map(async (extEvent) => {
      const extension = extEvent.extension
      const registrationId = remoteExtensions[extension.localIdentifier]
      if (!registrationId) return
      return useConcurrentOutputContext({outputPrefix: extension.outputPrefix}, async () => {
        return performActionWithRetryAfterRecovery(
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
      })
    })
    await Promise.all(promises)
  })

  // await Promise.all(
  //   extensions.map(async (extension) => {
  //     return useConcurrentOutputContext({outputPrefix: extension.outputPrefix}, async () => {
  //       await extension.build({
  //         app,
  //         stdout,
  //         stderr,
  //         useTasks: false,
  //         signal,
  //         environment: 'development',
  //       })
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
