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
import {outputCompleted} from '@shopify/cli-kit/node/output'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'

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
  const {extensionsNonUuidManaged, extensionsIdsNonUuidManaged} = await ensureNonUuidManagedExtensionsIds(
    configurationRegistrations,
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
    const registration = extensionRegistrations.find((registration) => registration.uuid === uuid)
    if (registration) validMatchesById[localIdentifier] = registration.id
  }

  return {
    extensions: validMatches,
    extensionIds: {...validMatchesById, ...mapExtensionsIdsNonUuidManaged(extensionsIdsNonUuidManaged)},
    extensionsNonUuidManaged,
  }
}

async function ensureNonUuidManagedExtensionsIds(
  remoteConfigurationRegistrations: RemoteSource[],
  app: AppInterface,
  appId: string,
  includeDraftExtensions = false,
  developerPlatformClient: DeveloperPlatformClient,
) {
  let localExtensionRegistrations = includeDraftExtensions ? app.realExtensions : app.allExtensions

  localExtensionRegistrations = localExtensionRegistrations.filter((ext) => !ext.isUuidManaged())

  const extensionsToCreate: LocalSource[] = []
  const validMatches: {[key: string]: string[]} = {}
  const validMatchesById: {[key: string]: string[]} = {}

  const extensionsInGlobalConfig = localExtensionRegistrations.filter((ext) => ext.specification.extensionManagedInToml)

  await Promise.all(
    extensionsInGlobalConfig.map(async (extension) => {
      // are there any matches for global configs?
      const possibleMatches = remoteConfigurationRegistrations.filter((remote) => {
        return remote.type === developerPlatformClient.toExtensionGraphQLType(extension.graphQLType)
      })

      // if there are existing webhook subscription etension registrations
      if (possibleMatches.length > 0) {
        const localConfigContent = await extension.commonDeployConfig('')

        // gets all the subscription objects in an array
        const localConfigArray = getPathValue<unknown[]>(
          localConfigContent as object,
          extension.specification.multipleModuleConfigPath ?? '',
        )
        const matchedUuids: string[] = []
        const matchedIds: string[] = []
        const newExtensionsToCreate: ExtensionInstance[] = []

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        localConfigArray?.forEach((localConfig: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hasMatch = possibleMatches?.some((possibleMatch: any) => {
            const remoteConfigString = possibleMatch.activeVersion?.config
            const remoteConfigObj = remoteConfigString ? JSON.parse(remoteConfigString) : ''
            if (localConfig.uri === remoteConfigObj.uri && localConfig.topic === remoteConfigObj.topic) {
              matchedUuids.push(possibleMatch.uuid)
              matchedIds.push(possibleMatch.id)
              return true
            }
          })
          // if there are no matches, add the extension to create new extensions array
          if (!hasMatch) {
            newExtensionsToCreate.push(extension)
          }
        })

        // creates the new extensions
        const newExtensionRegistrationIds = await Promise.all(
          newExtensionsToCreate?.map(async (extension) => {
            const registration = await createExtension(
              appId,
              extension.graphQLType,
              extension.handle,
              developerPlatformClient,
              extension.contextValue,
            )
            return [registration.id, registration.uuid]
          }),
        )
        const newUuids = newExtensionRegistrationIds.flatMap(([, uuid]) => uuid!)
        const newIds = newExtensionRegistrationIds.flatMap(([id]) => id!)
        validMatches[extension.localIdentifier] = matchedUuids.concat(newUuids)
        validMatchesById[extension.localIdentifier] = matchedIds.concat(newIds)
      } else {
        // creates all new extension instances
        // this will create new uuids for each webhook subscription modules
        const localSources = await buildExtensionsInGlobalToCreate(extension)
        const extensionRegistrations = await Promise.all(
          localSources.map(async (extension) => {
            // extension?
            const registration = await createExtension(
              appId,
              extension.graphQLType,
              extension.handle,
              developerPlatformClient,
              extension.contextValue,
            )
            return [registration.id, registration.uuid]
          }),
        )

        validMatches[extension.localIdentifier] = extensionRegistrations.flatMap(([, uuid]) => uuid!)
        validMatchesById[extension.localIdentifier] = extensionRegistrations.flatMap(([id]) => id!)
      }
    }),
  )

  const extensionNotInGlobalConfig = localExtensionRegistrations.filter(
    (ext) => !ext.specification.extensionManagedInToml,
  )
  extensionNotInGlobalConfig.forEach((local) => {
    const possibleMatch = remoteConfigurationRegistrations.find((remote) => {
      return remote.type === developerPlatformClient.toExtensionGraphQLType(local.graphQLType)
    })
    if (possibleMatch) {
      validMatches[local.localIdentifier] = [possibleMatch.uuid]
      validMatchesById[local.localIdentifier] = [possibleMatch.id]
    } else extensionsToCreate.push(local)
  })

  if (extensionsToCreate.length > 0) {
    const newIdentifiers = await createExtensions(extensionsToCreate, appId, developerPlatformClient, false)
    for (const [localIdentifier, registration] of Object.entries(newIdentifiers)) {
      validMatches[localIdentifier] = [registration.uuid]
      validMatchesById[localIdentifier] = [registration.id]
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

async function buildExtensionsInGlobalToCreate(extension: ExtensionInstance): Promise<LocalSource[]> {
  if (!extension.specification.multipleModuleConfigPath) return [extension]

  const configContent = await extension.commonDeployConfig('')

  const multipleRootPathValue = getPathValue<unknown[]>(
    configContent as object,
    extension.specification.multipleModuleConfigPath,
  )

  // [ {topic: ..., uri: ...},  {...}]

  // [ ExtensionInstance, ExtensionInstance ]
  // ExtensionInstance
  // config -> {api_version: ..., subscriptions: []}
  return Array.from({length: multipleRootPathValue?.length ?? 0}).map((_value, index) => extension)
}

function mapExtensionsIdsNonUuidManaged(extensionsIdsNonUuidManaged: {[key: string]: string[]}) {
  const result: {[key: string]: string} = {}
  for (const key in extensionsIdsNonUuidManaged) {
    if (extensionsIdsNonUuidManaged[key]!.length > 0) {
      result[key] = extensionsIdsNonUuidManaged[key]![0]!
    }
  }
  return result
}
