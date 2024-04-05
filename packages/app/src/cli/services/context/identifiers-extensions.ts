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
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {outputCompleted} from '@shopify/cli-kit/node/output'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {getPathValue} from '@shopify/cli-kit/common/object'

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

  let onlyRemoteExtensions = matchExtensions.toManualMatch.remote ?? []

  if (matchExtensions.toManualMatch.local.length > 0) {
    const matchResult = await manualMatchIds(matchExtensions.toManualMatch, 'uuid')
    validMatches = {...validMatches, ...matchResult.identifiers}
    extensionsToCreate.push(...matchResult.toCreate)
    onlyRemoteExtensions = matchResult.onlyRemote
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
    // We neeed to figure out how to handle a extension with a list of registrations
    // This should only affect the dev command to push the draft content
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
  let localExtensionRegistrations = includeDraftExtensions ? app.draftableExtensions : app.allExtensions

  localExtensionRegistrations = localExtensionRegistrations.filter((ext) => !ext.isUuidManaged())
  const extensionsToCreate: LocalSource[] = []
  const validMatches: {[key: string]: string[]} = {}
  const validMatchesById: {[key: string]: string[]} = {}

  const extensionsInGlobalConfig = localExtensionRegistrations.filter((ext) => ext.specification.globalConfig)

  await Promise.all(
    extensionsInGlobalConfig.map(async (extension) => {
      const localSources = buildExtensionsInGlobalToCreate(extension)

      const extensionRegistrations = await Promise.all(
        localSources.map(async (extension) => {
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
    }),
  )

  const extensionNotInGlobalConfig = localExtensionRegistrations.filter((ext) => !ext.specification.globalConfig)

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

function buildExtensionsInGlobalToCreate(extension: ExtensionInstance): LocalSource[] {
  if (!extension.specification.multipleRootPath) return [extension]

  const multipleRootPathValue = getPathValue<unknown[]>(
    extension.configuration,
    extension.specification.multipleRootPath,
  )

  let extArrLength = multipleRootPathValue?.length ?? 0

  // this lets us get the right number of uuids per subscription
  if (extension.specification.identifier === 'webhooks_subscriptions') {
    let topicsCount = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    multipleRootPathValue?.forEach((subscriptionObj: any) => {
      if (subscriptionObj.topics) {
        topicsCount += subscriptionObj.topics.length
      }
    })
    extArrLength = topicsCount
  }

  return Array.from({length: extArrLength}).map(() => extension)
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
