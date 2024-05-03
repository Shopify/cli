import {manualMatchIds} from './id-manual-matching.js'
import {automaticMatchmaking} from './id-matching.js'
import {EnsureDeploymentIdsPresenceOptions, LocalSource, RemoteSource} from './identifiers.js'
import {extensionMigrationPrompt, matchConfirmationPrompt} from './prompts.js'
import {createExtension} from '../dev/create-extension.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {getUIExtensionsToMigrate, migrateExtensionsToUIExtension} from '../dev/migrate-to-ui-extension.js'
import {getFlowExtensionsToMigrate, migrateFlowExtensions} from '../dev/migrate-flow-extension.js'
import {AppInterface} from '../../models/app/app.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {getPaymentsExtensionsToMigrate, migrateAppModules} from '../dev/migrate-app-module.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {outputCompleted} from '@shopify/cli-kit/node/output'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

interface AppWithExtensions {
  extensionRegistrations: RemoteSource[]
  dashboardManagedExtensionRegistrations: RemoteSource[]
}

export async function ensureExtensionsIds(
  options: EnsureDeploymentIdsPresenceOptions,
  {
    extensionRegistrations: initialRemoteExtensions,
    dashboardManagedExtensionRegistrations: dashboardOnlyExtensions,
  }: AppWithExtensions,
) {
  let remoteExtensions = initialRemoteExtensions
  const validIdentifiers = options.envIdentifiers.extensions ?? {}
  const localExtensions = options.app.allExtensions.filter((ext) => ext.isUuidManaged())

  const uiExtensionsToMigrate = getUIExtensionsToMigrate(localExtensions, remoteExtensions, validIdentifiers)
  const flowExtensionsToMigrate = getFlowExtensionsToMigrate(localExtensions, dashboardOnlyExtensions, validIdentifiers)
  const paymentsExtensionsToMigrate = getPaymentsExtensionsToMigrate(
    localExtensions,
    dashboardOnlyExtensions,
    validIdentifiers,
  )

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
      dashboardOnlyExtensions,
      options.developerPlatformClient,
    )
    remoteExtensions = remoteExtensions.concat(newRemoteExtensions)
  }

  if (paymentsExtensionsToMigrate.length > 0) {
    const confirmedMigration = await extensionMigrationPrompt(paymentsExtensionsToMigrate, false)
    if (!confirmedMigration) throw new AbortSilentError()
    const newRemoteExtensions = await migrateAppModules(
      paymentsExtensionsToMigrate,
      options.appId,
      'payments_extension',
      dashboardOnlyExtensions,
      options.developerPlatformClient,
    )
    remoteExtensions = remoteExtensions.concat(newRemoteExtensions)
  }

  const matchExtensions = await automaticMatchmaking(localExtensions, remoteExtensions, validIdentifiers, 'uuid')

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
    const matchResult = await manualMatchIds(matchExtensions.toManualMatch, 'uuid')
    validMatches = {...validMatches, ...matchResult.identifiers}
    extensionsToCreate.push(...matchResult.toCreate)
  }

  return {
    validMatches,
    extensionsToCreate,
    dashboardOnlyExtensions,
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
  const {uuidUidStrategyExtensions, allRegistrationsManagedInConfig} = shiftRegistrationsAround(
    extensionRegistrations,
    configurationRegistrations,
    options.app.specifications || [],
  )

  const {extensionsNonUuidManaged, extensionsIdsNonUuidManaged} = await ensureNonUuidManagedExtensionsIds(
    allRegistrationsManagedInConfig,
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
    extensionsNonUuidManaged: {...extensionsNonUuidManaged},
  }
}

function matchWebhooks(remoteConfigObj: {[key: string]: unknown}, extension: ExtensionInstance) {
  const transformLocalConfig = extension.specification.transform?.(extension.configuration) as unknown as {
    [key: string]: unknown
  }
  if (transformLocalConfig) {
    return remoteConfigObj.topic === transformLocalConfig.topic && remoteConfigObj.uri === transformLocalConfig.uri
  } else {
    return false
  }
}

async function loadExtensionIds(
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

    if (local.isSingleStrategyExtension && possibleMatches.length === 1) {
      validMatches[local.localIdentifier] = possibleMatches[0]!.uuid
      validMatchesById[local.localIdentifier] = possibleMatches[0]!.id
    } else if (local.isDynamicStrategyExtension) {
      // can probably move this out to a separate function if we want to clean this further?
      const match = possibleMatches.find((possibleMatch) => {
        const remoteVersionConfig = possibleMatch.activeVersion?.config ?? possibleMatch.draftVersion?.config
        const remoteVersionConfigObj = remoteVersionConfig ? JSON.parse(remoteVersionConfig) : undefined
        return matchWebhooks(remoteVersionConfigObj, local)
      })
      if (match) {
        validMatches[local.localIdentifier] = match.uuid
        validMatchesById[local.localIdentifier] = match.id
      } else {
        extensionsToCreate.push(local)
      }
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
  let localExtensionRegistrations = includeDraftExtensions ? app.realExtensions : app.allExtensions

  localExtensionRegistrations = localExtensionRegistrations.filter((ext) => !ext.isUuidManaged())

  const extensionsToCreate: LocalSource[] = []
  const validMatches: {[key: string]: string} = {}
  const validMatchesById: {[key: string]: string} = {}

  await loadExtensionIds(
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
  let counter = 0
  for (const extension of extensions) {
    counter++
    if (developerPlatformClient.supportsAtomicDeployments) {
      // Just pretend to create the extension, as it's not necessary to do anything
      // in this case.
      result[extension.localIdentifier] = {
        id: `${extension.localIdentifier}-${counter}`,
        uuid: `${extension.localIdentifier}-${counter}`,
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

export function shiftRegistrationsAround(
  extensionRegistrations: RemoteSource[],
  configurationRegistrations: RemoteSource[],
  specifications: ExtensionSpecification[],
) {
  const dynamicUidStrategySpecs =
    specifications
      ?.filter((specification) => specification.uidStrategy === 'dynamic')
      .map((specification) => specification.identifier) ?? []
  const dynamicUidStrategyExtensions = extensionRegistrations.filter((registration) => {
    return dynamicUidStrategySpecs.includes(registration.type.toLowerCase())
  })
  const uuidUidStrategyExtensions = extensionRegistrations.filter((registration) => {
    return !dynamicUidStrategySpecs.includes(registration.type.toLowerCase())
  })
  const allRegistrationsManagedInConfig = configurationRegistrations.concat(dynamicUidStrategyExtensions)
  return {uuidUidStrategyExtensions, allRegistrationsManagedInConfig}
}
