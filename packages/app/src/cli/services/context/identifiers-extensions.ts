import {manualMatchIds} from './id-manual-matching.js'
import {automaticMatchmaking} from './id-matching.js'
import {EnsureDeploymentIdsPresenceOptions, LocalSource, RemoteSource} from './identifiers.js'
import {extensionMigrationPrompt, matchConfirmationPrompt} from './prompts.js'
import {createExtension} from '../dev/create-extension.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {migrateExtensionsToUIExtension} from '../dev/migrate-to-ui-extension.js'
import {migrateFlowExtensions} from '../dev/migrate-flow-extension.js'
import {AppInterface} from '../../models/app/app.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {
  FlowModulesMap,
  getModulesToMigrate,
  MarketingModulesMap,
  migrateAppModules,
  PaymentModulesMap,
  UIModulesMap,
} from '../dev/migrate-app-module.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {SingleWebhookSubscriptionType} from '../../models/extensions/specifications/app_config_webhook_schemas/webhooks_schema.js'
import {outputCompleted} from '@shopify/cli-kit/node/output'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {groupBy} from '@shopify/cli-kit/common/collection'

interface AppWithExtensions {
  extensionRegistrations: RemoteSource[]
  dashboardManagedExtensionRegistrations: RemoteSource[]
}

export async function ensureExtensionsIds(
  options: EnsureDeploymentIdsPresenceOptions,
  {
    extensionRegistrations: initialRemoteExtensions,
    dashboardManagedExtensionRegistrations: dashboardExtensions,
  }: AppWithExtensions,
) {
  let remoteExtensions = initialRemoteExtensions
  const identifiers = options.envIdentifiers.extensions ?? {}
  const localExtensions = options.app.allExtensions.filter((ext) => ext.isUUIDStrategyExtension)

  const uiExtensionsToMigrate = getModulesToMigrate(localExtensions, remoteExtensions, identifiers, UIModulesMap)
  const flowExtensionsToMigrate = getModulesToMigrate(localExtensions, dashboardExtensions, identifiers, FlowModulesMap)
  const paymentsToMigrate = getModulesToMigrate(localExtensions, dashboardExtensions, identifiers, PaymentModulesMap)
  const marketingToMigrate = getModulesToMigrate(localExtensions, dashboardExtensions, identifiers, MarketingModulesMap)

  if (uiExtensionsToMigrate.length > 0) {
    const confirmedMigration = await extensionMigrationPrompt(uiExtensionsToMigrate)
    if (!confirmedMigration) throw new AbortSilentError()
    remoteExtensions = await migrateExtensionsToUIExtension(
      uiExtensionsToMigrate,
      options.appId,
      remoteExtensions,
      options.developerPlatformClient,
    )
  }

  if (flowExtensionsToMigrate.length > 0) {
    const confirmedMigration = await extensionMigrationPrompt(flowExtensionsToMigrate, false)
    if (!confirmedMigration) throw new AbortSilentError()
    const newRemoteExtensions = await migrateFlowExtensions(
      flowExtensionsToMigrate,
      options.appId,
      dashboardExtensions,
      options.developerPlatformClient,
    )
    remoteExtensions = remoteExtensions.concat(newRemoteExtensions)
  }

  if (marketingToMigrate.length > 0) {
    const confirmedMigration = await extensionMigrationPrompt(marketingToMigrate, false)
    if (!confirmedMigration) throw new AbortSilentError()
    const newRemoteExtensions = await migrateAppModules(
      marketingToMigrate,
      options.appId,
      'marketing_activity',
      dashboardExtensions,
      options.developerPlatformClient,
    )
    remoteExtensions = remoteExtensions.concat(newRemoteExtensions)
  }

  if (paymentsToMigrate.length > 0) {
    const confirmedMigration = await extensionMigrationPrompt(paymentsToMigrate, false)
    if (!confirmedMigration) throw new AbortSilentError()
    const newRemoteExtensions = await migrateAppModules(
      paymentsToMigrate,
      options.appId,
      'payments_extension',
      dashboardExtensions,
      options.developerPlatformClient,
    )
    remoteExtensions = remoteExtensions.concat(newRemoteExtensions)
  }

  const matchExtensions = await automaticMatchmaking(
    localExtensions,
    remoteExtensions,
    identifiers,
    options.developerPlatformClient,
  )

  let validMatches = matchExtensions.identifiers
  const extensionsToCreate = matchExtensions.toCreate ?? []

  for (const pending of matchExtensions.toConfirm) {
    // eslint-disable-next-line no-await-in-loop
    const confirmed = await matchConfirmationPrompt(pending.local, pending.remote)
    if (confirmed) {
      validMatches[pending.local.localIdentifier] = pending.remote.uuid
    } else {
      extensionsToCreate.push(pending.local)
    }
  }

  if (matchExtensions.toManualMatch.local.length > 0) {
    const matchResult = await manualMatchIds(matchExtensions.toManualMatch)
    validMatches = {...validMatches, ...matchResult.identifiers}
    extensionsToCreate.push(...matchResult.toCreate)
  }

  return {
    validMatches,
    extensionsToCreate,
    dashboardOnlyExtensions: dashboardExtensions,
  }
}

export async function deployConfirmed(
  options: EnsureDeploymentIdsPresenceOptions,
  extensionRegistrations: RemoteSource[],
  configurationRegistrations: RemoteSource[],
  {
    validMatches,
    extensionsToCreate,
  }: {
    validMatches: IdentifiersExtensions
    extensionsToCreate: LocalSource[]
  },
) {
  const {uuidUidStrategyExtensions, singleAndDynamicStrategyExtensions} = groupRegistrationByUidStrategy(
    extensionRegistrations,
    configurationRegistrations,
    options.app.specifications || [],
  )

  const {extensionsNonUuidManaged, extensionsIdsNonUuidManaged} = await ensureNonUuidManagedExtensionsIds(
    singleAndDynamicStrategyExtensions,
    options.app,
    options.appId,
    options.includeDraftExtensions,
    options.developerPlatformClient,
  )

  const validMatchesById: {[key: string]: string} = {}
  if (extensionsToCreate.length > 0) {
    const newIdentifiers = await createExtensions(extensionsToCreate, options.appId, options.developerPlatformClient)
    for (const [localIdentifier, registration] of Object.entries(newIdentifiers)) {
      validMatches[localIdentifier] = registration.uuid
      validMatchesById[localIdentifier] = registration.id
    }
  }

  // For extensions we also need the match by ID, not only UUID (doesn't apply to functions)
  for (const [localIdentifier, uuid] of Object.entries(validMatches)) {
    const registration = uuidUidStrategyExtensions.find((registration) => registration.uuid === uuid)
    if (registration) validMatchesById[localIdentifier] = registration.id
  }

  return {
    extensions: validMatches,
    extensionIds: {...validMatchesById, ...extensionsIdsNonUuidManaged},
    extensionsNonUuidManaged,
  }
}

function matchWebhooks(remoteSource: RemoteSource, extension: ExtensionInstance) {
  const remoteVersionConfig = remoteSource.activeVersion?.config
  const remoteVersionConfigObj = remoteVersionConfig ? JSON.parse(remoteVersionConfig) : {}
  const localConfig = extension.configuration as unknown as SingleWebhookSubscriptionType
  const remoteUri: string = remoteVersionConfigObj.uri || ''
  return (
    remoteVersionConfigObj.topic === localConfig.topic &&
    remoteUri.endsWith(localConfig.uri) &&
    remoteVersionConfigObj.filter === localConfig.filter
  )
}

function loadExtensionIds(
  remoteConfigurationRegistrations: RemoteSource[],
  developerPlatformClient: DeveloperPlatformClient,
  localExtensionRegistrations: ExtensionInstance[],
  extensionsToCreate: LocalSource[],
  validMatches: {[key: string]: unknown},
  validMatchesById: {[key: string]: unknown},
) {
  localExtensionRegistrations.forEach((local) => {
    const possibleMatches = remoteConfigurationRegistrations.filter((remote) => {
      return remote.type === developerPlatformClient.toExtensionGraphQLType(local.graphQLType)
    })

    let match: RemoteSource | undefined
    if (local.isSingleStrategyExtension && possibleMatches.length === 1) {
      match = possibleMatches[0]
    } else if (local.isDynamicStrategyExtension) {
      match = possibleMatches.find((possibleMatch) => matchWebhooks(possibleMatch, local))
    }

    if (match) {
      validMatches[local.localIdentifier] = match.uuid
      validMatchesById[local.localIdentifier] = match.id
    } else {
      extensionsToCreate.push(local)
    }
  })
}

export async function ensureNonUuidManagedExtensionsIds(
  remoteConfigurationRegistrations: RemoteSource[],
  app: AppInterface,
  appId: string,
  includeDraftExtensions = false,
  developerPlatformClient: DeveloperPlatformClient,
) {
  let localExtensionRegistrations = includeDraftExtensions ? app.draftableExtensions : app.allExtensions

  localExtensionRegistrations = localExtensionRegistrations.filter((ext) => !ext.isUUIDStrategyExtension)

  const extensionsToCreate: LocalSource[] = []
  const validMatches: {[key: string]: string} = {}
  const validMatchesById: {[key: string]: string} = {}

  loadExtensionIds(
    remoteConfigurationRegistrations,
    developerPlatformClient,
    localExtensionRegistrations,
    extensionsToCreate,
    validMatches,
    validMatchesById,
  )

  if (extensionsToCreate.length > 0) {
    const newIdentifiers = await createExtensions(extensionsToCreate, appId, developerPlatformClient, false)
    for (const [localIdentifier, registration] of Object.entries(newIdentifiers)) {
      validMatches[localIdentifier] = registration.uuid
      validMatchesById[localIdentifier] = registration.id
    }
  }

  return {extensionsNonUuidManaged: validMatches, extensionsIdsNonUuidManaged: validMatchesById}
}

async function createExtensions(
  extensions: LocalSource[],
  appId: string,
  developerPlatformClient: DeveloperPlatformClient,
  output = true,
) {
  const result: {[localIdentifier: string]: RemoteSource} = {}
  for (const extension of extensions) {
    if (developerPlatformClient.supportsAtomicDeployments) {
      // Just pretend to create the extension, as it's not necessary to do anything
      // in this case.
      result[extension.localIdentifier] = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        id: extension.uid!,
        uid: extension.uid,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        uuid: extension.uid!,
        type: extension.type,
        title: extension.handle,
      }
    } else {
      // Create one at a time to avoid API rate limiting issues.
      // eslint-disable-next-line no-await-in-loop
      const registration = await createExtension(
        appId,
        extension.graphQLType,
        extension.handle,
        developerPlatformClient,
        extension.contextValue,
      )
      if (output) outputCompleted(`Created extension ${extension.handle}.`)
      result[extension.localIdentifier] = registration
    }
  }
  return result
}

export function groupRegistrationByUidStrategy(
  extensionRegistrations: RemoteSource[],
  configurationRegistrations: RemoteSource[],
  specifications: ExtensionSpecification[],
) {
  const dynamicUidStrategySpecs = specifications
    .filter((spec) => spec.uidStrategy === 'dynamic')
    .map((spec) => spec.identifier)

  const isDynamic = (registration: RemoteSource) => dynamicUidStrategySpecs.includes(registration.type.toLowerCase())
  const groupedExtensions = groupBy(extensionRegistrations, isDynamic)

  const singleAndDynamicStrategyExtensions = configurationRegistrations.concat(groupedExtensions.true ?? [])
  return {uuidUidStrategyExtensions: groupedExtensions.false ?? [], singleAndDynamicStrategyExtensions}
}
