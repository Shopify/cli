import {RemoteSource, LocalSource} from './identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {pickBy} from '@shopify/cli-kit/common/object'

export interface LocalRemoteSource {
  local: LocalSource
  remote: RemoteSource
}

interface MatchResult {
  identifiers: IdentifiersExtensions
  toConfirm: LocalRemoteSource[]
  toCreate: LocalSource[]
  toManualMatch: {local: LocalSource[]; remote: RemoteSource[]}
}

/**
 * Automatically match local and remote sources if they have the same UID
 */
function matchByUUID(
  local: LocalSource[],
  remote: RemoteSource[],
): {
  matched: IdentifiersExtensions
  toCreate: LocalSource[]
  toConfirm: {local: LocalSource; remote: RemoteSource}[]
  toManualMatch: {local: LocalSource[]; remote: RemoteSource[]}
} {
  const matched: IdentifiersExtensions = {}

  local.forEach((localSource) => {
    const possibleMatch = remote.find((remoteSource) => remoteSource.uuid === localSource.uid)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (possibleMatch) matched[localSource.localIdentifier] = possibleMatch.uuid!
  })

  const toCreate = local.filter((elem) => !matched[elem.localIdentifier])

  return {matched, toCreate, toConfirm: [], toManualMatch: {local: [], remote: []}}
}

function migrateLegacyFunctions(
  ids: IdentifiersExtensions,
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
): {
  migrated: IdentifiersExtensions
  pending: {local: LocalSource[]; remote: RemoteSource[]}
} {
  const migrated: IdentifiersExtensions = {}
  const pendingMigrations: IdentifiersExtensions = {}

  remoteSources
    .filter((extension) => extension.type === 'FUNCTION')
    .forEach((functionExtension) => {
      const config = functionExtension.draftVersion?.config
      if (config === undefined) return

      const parsedConfig = JSON.parse(config)
      const legacyId = parsedConfig.legacy_function_id
      if (legacyId) pendingMigrations[legacyId] = functionExtension.uuid

      const legacyUuid = parsedConfig.legacy_function_uuid
      if (legacyUuid) pendingMigrations[legacyUuid] = functionExtension.uuid
    })

  localSources
    .filter((extension) => extension.type === 'function')
    .forEach((functionExtension) => {
      const localId = ids[functionExtension.localIdentifier]
      if (localId === undefined) return

      const remoteId = pendingMigrations[localId]
      if (remoteId) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete pendingMigrations[functionExtension.localIdentifier]
        migrated[functionExtension.localIdentifier] = remoteId
      }
    })

  const pendingLocal = localSources.filter((elem) => !migrated[elem.localIdentifier])
  const pendingRemote = remoteSources.filter((registration) => !Object.values(migrated).includes(registration.uuid))

  return {
    migrated,
    pending: {
      local: pendingLocal,
      remote: pendingRemote,
    },
  }
}

/**
 * Automatically match local sources to remote sources.
 * If we can't match a local source to any remote sources, we can create it.
 * If we are unsure about the matching we can ask the user to confirm the relationship.
 */
export async function automaticMatchmaking(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<MatchResult> {
  const ids = getExtensionIds(localSources, identifiers)
  const localIds = Object.values(ids)

  const existsRemotely = (local: LocalSource) =>
    remoteSources.some((remote) => {
      if (remote.type !== developerPlatformClient.toExtensionGraphQLType(local.graphQLType)) return false
      return ids[local.localIdentifier] === remote.uuid
    })

  const {migrated: migratedFunctions, pending: pendingAfterMigratingFunctions} = migrateLegacyFunctions(
    ids,
    localSources.filter((local) => !existsRemotely(local)),
    remoteSources.filter((remote) => !localIds.includes(remote.uuid)),
  )
  const {local, remote} = pendingAfterMigratingFunctions

  const {matched, toCreate, toConfirm, toManualMatch} = matchByUUID(local, remote)

  return {
    identifiers: {...ids, ...matched, ...migratedFunctions},
    toConfirm,
    toCreate,
    toManualMatch,
  }
}

export function getExtensionIds(
  localSources: LocalSource[],
  identifiers: IdentifiersExtensions,
): IdentifiersExtensions {
  const localSourcesIds = localSources.map((source) => source.localIdentifier)

  return pickBy(identifiers, (_, id) => localSourcesIds.includes(id))
}
