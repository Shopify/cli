import {RemoteSource, LocalSource} from './identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {groupBy, partition} from '@shopify/cli-kit/common/collection'
import {uniqBy, difference} from '@shopify/cli-kit/common/array'
import {pickBy} from '@shopify/cli-kit/common/object'
import {slugify} from '@shopify/cli-kit/common/string'

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
 * Filter function to match a local and a remote source by type and handle
 */
const sameTypeAndName = (local: LocalSource, remote: RemoteSource) => {
  return remote.type === local.graphQLType && slugify(remote.title) === slugify(local.handle)
}

/**
 * Automatically match local and remote sources if they have the same type and handle, and then only by type
 *
 * If multiple local or remote sources have the same type and handle, they can't be matched automatically
 */
function matchByNameAndType(
  local: LocalSource[],
  remote: RemoteSource[],
): {
  matched: IdentifiersExtensions
  toCreate: LocalSource[]
  toConfirm: {local: LocalSource; remote: RemoteSource}[]
  toManualMatch: {local: LocalSource[]; remote: RemoteSource[]}
} {
  // We try to automatically match sources if they have the same name and type,
  // by considering local sources which are missing on the remote side and
  // remote sources which are not synchronized locally.
  const uniqueLocal = uniqBy(local, (elem) => [elem.graphQLType, elem.handle])
  const uniqueRemote = uniqBy(remote, (elem) => [elem.type, elem.title])

  const matched: IdentifiersExtensions = {}

  uniqueLocal.forEach((localSource) => {
    const possibleMatch = uniqueRemote.find((remoteSource) => sameTypeAndName(localSource, remoteSource))
    if (possibleMatch) matched[localSource.localIdentifier] = possibleMatch.uuid
  })

  const pendingLocal = local.filter((elem) => !matched[elem.localIdentifier])
  const pendingRemote = remote.filter((registration) => !Object.values(matched).includes(registration.uuid))

  // Now we try to find a match between a local source and remote one if they have
  // the same type and they are unique even if they have different names. For example:
  // LOCAL_CHECKOUT_UI_NAMED_APPLE -> REMOTE_CHECKOUT_UI_NAMED_PEAR
  // LOCAL_PROD_SUBSCR_NAMED_ORANGE -> REMOTE_PROD_SUBSCR_NAMED_LEMON
  const {toConfirm, toCreate, toManualMatch} = matchByUniqueType(pendingLocal, pendingRemote)

  return {matched, toCreate, toConfirm, toManualMatch}
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
 * Ask the user to confirm the relationship between a local source and a remote source if they
 * the only ones of their types.
 */
function matchByUniqueType(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
): {
  toCreate: LocalSource[]
  toConfirm: {local: LocalSource; remote: RemoteSource}[]
  toManualMatch: {local: LocalSource[]; remote: RemoteSource[]}
} {
  const localGroups = groupBy(localSources, 'graphQLType')
  const localUnique = Object.values(pickBy(localGroups, (group, _key) => group.length === 1)).flat()

  const remoteGroups = groupBy(remoteSources, 'type')
  const remoteUniqueMap = pickBy(remoteGroups, (group, _key) => group.length === 1)

  const toConfirm: {local: LocalSource; remote: RemoteSource}[] = []
  const toCreate: LocalSource[] = []

  // for every local source that has a unique type we either:
  // - find a corresponding unique remote source and ask the user to confirm
  // - create it from scratch
  for (const local of localUnique) {
    const remote = remoteUniqueMap[local.graphQLType]
    if (remote && remote[0]) {
      toConfirm.push({local, remote: remote[0]})
    } else {
      toCreate.push(local)
    }
  }

  // now for every local source with a duplicated type we check
  // if there is a remote source with the same type. if the answer is no,
  // it means that we need to create them.
  const localDuplicated = difference(localSources, localUnique)
  const remotePending = difference(
    remoteSources,
    toConfirm.map((elem) => elem.remote),
  )
  const [localPending, localToCreate] = partition(localDuplicated, (local) =>
    remotePending.map((remote) => remote.type).includes(local.graphQLType),
  )
  toCreate.push(...localToCreate)

  return {
    toCreate,
    toConfirm,
    toManualMatch: {
      local: localPending,
      remote: remotePending,
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
  const useUuidMatching = developerPlatformClient.supportsAtomicDeployments
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

  const {matched, toCreate, toConfirm, toManualMatch} = useUuidMatching
    ? matchByUUID(local, remote)
    : matchByNameAndType(local, remote)

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
