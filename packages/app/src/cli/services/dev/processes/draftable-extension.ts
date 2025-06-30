import {BaseProcess, DevProcessFunction} from './types.js'
import {updateExtensionDraft} from '../update-extension.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {AppInterface} from '../../../models/app/app.js'
import {PartnersAppForIdentifierMatching, ensureDeploymentIdsPresence} from '../../context/identifiers.js'
import {getAppIdentifiers} from '../../../models/app/identifiers.js'
import {installJavy} from '../../function/build.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppEvent, AppEventWatcher, EventType} from '../app-events/app-event-watcher.js'
import {AbortError} from '@shopify/cli-kit/node/error'
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

  const draftableExtensions = app.draftableExtensions.map((ext) => ext.handle)

  const handleAppEvent = async (event: AppEvent) => {
    const extensionEvents = event.extensionEvents
      .filter((ev) => ev.type === EventType.Updated)
      .filter((ev) => ev.buildResult?.status === 'ok')
      .filter((ev) => draftableExtensions.includes(ev.extension.handle))

    const promises = extensionEvents.map(async (extensionEvent) => {
      const extension = extensionEvent.extension
      const registrationId = remoteExtensions[extension.localIdentifier]
      if (!registrationId) throw new AbortError(`Extension ${extension.localIdentifier} not found on remote app.`)
      await useConcurrentOutputContext({outputPrefix: extension.outputPrefix}, async () => {
        await updateExtensionDraft({
          extension,
          developerPlatformClient,
          apiKey,
          registrationId,
          stdout,
          stderr,
          appConfiguration: app.configuration,
          bundlePath: appWatcher.buildOutputPath,
        })
      })
    })
    await Promise.all(promises)
  }

  appWatcher.onEvent(handleAppEvent).onStart(handleAppEvent)
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
