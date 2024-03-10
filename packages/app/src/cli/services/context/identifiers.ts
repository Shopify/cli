import {deployConfirmed} from './identifiers-extensions.js'
import {configExtensionsIdentifiersBreakdown, extensionsIdentifiersDeployBreakdown} from './breakdown-extensions.js'
import {AppInterface} from '../../models/app/app.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {MinimalOrganizationApp} from '../../models/organization.js'
import {deployOrReleaseConfirmationPrompt} from '../../prompts/deploy-release.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

export type PartnersAppForIdentifierMatching = MinimalOrganizationApp

export interface EnsureDeploymentIdsPresenceOptions {
  app: AppInterface
  developerPlatformClient: DeveloperPlatformClient
  appId: string
  appName: string
  envIdentifiers: Partial<Identifiers>
  force: boolean
  release: boolean
  remoteApp: PartnersAppForIdentifierMatching
  includeDraftExtensions?: boolean
}

export interface RemoteSource {
  uuid: string
  type: string
  id: string
  title: string
  draftVersion?: {config: string}
}

export interface LocalSource {
  localIdentifier: string
  graphQLType: string
  type: string
  handle: string
  contextValue: string
}

export async function ensureDeploymentIdsPresence(options: EnsureDeploymentIdsPresenceOptions) {
  const {extensionIdentifiersBreakdown, extensionsToConfirm, remoteExtensionsRegistrations} =
    await extensionsIdentifiersDeployBreakdown(options)

  const configExtensionIdentifiersBreakdown = await configExtensionsIdentifiersBreakdown({
    developerPlatformClient: options.developerPlatformClient,
    apiKey: options.appId,
    localApp: options.app,
    remoteApp: options.remoteApp,
    release: options.release,
  })

  const confirmed = await deployOrReleaseConfirmationPrompt({
    extensionIdentifiersBreakdown,
    configExtensionIdentifiersBreakdown,
    appTitle: options.remoteApp?.title,
    release: options.release,
    force: options.force,
  })
  if (!confirmed) throw new AbortSilentError()

  const result = await deployConfirmed(
    options,
    remoteExtensionsRegistrations.extensionRegistrations,
    remoteExtensionsRegistrations.configurationRegistrations,
    extensionsToConfirm,
  )

  return {
    app: options.appId,
    extensions: result.extensions,
    extensionIds: result.extensionIds,
    extensionsNonUuidManaged: result.extensionsNonUuidManaged,
  }
}
