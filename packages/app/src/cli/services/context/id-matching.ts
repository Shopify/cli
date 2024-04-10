import {RemoteSource, LocalSource} from './identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
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
 * Automatically match local and remote sources if they have the same type and handle
 *
 * If multiple local or remote sources have the same type and handle, they can't be matched automatically
 */
function matchByNameAndType(
  local: LocalSource[],
  remote: RemoteSource[],
  remoteIdField: 'id' | 'uuid',
): {matched: IdentifiersExtensions; pending: {local: LocalSource[]; remote: RemoteSource[]}} {
  const uniqueLocal = uniqBy(local, (elem) => [elem.graphQLType, elem.handle])
  const uniqueRemote = uniqBy(remote, (elem) => [elem.type, elem.title])

  const validMatches: IdentifiersExtensions = {}

  uniqueLocal.forEach((localSource) => {
    const possibleMatch = uniqueRemote.find((remoteSource) => sameTypeAndName(localSource, remoteSource))
    if (possibleMatch) validMatches[localSource.localIdentifier] = possibleMatch[remoteIdField]
  })

  const pendingLocal = local.filter((elem) => !validMatches[elem.localIdentifier])
  const pendingRemote = remote.filter(
    (registration) => !Object.values(validMatches).includes(registration[remoteIdField]),
  )
  return {matched: validMatches, pending: {local: pendingLocal, remote: pendingRemote}}
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
  pending: {local: LocalSource[]; remote: RemoteSource[]}
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
    pending: {
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
  remoteIdField: 'id' | 'uuid',
): Promise<MatchResult> {
  const ids = getExtensionIds(localSources, identifiers)
  const localUUIDs = Object.values(ids)

  const existsRemotely = (local: LocalSource) =>
    remoteSources.some(
      (remote) => remote[remoteIdField] === ids[local.localIdentifier] && remote.type === local.graphQLType,
    )

  const {migrated: migratedFunctions, pending: pendingAfterMigratingFunctions} = migrateLegacyFunctions(
    ids,
    localSources.filter((local) => !existsRemotely(local)),
    remoteSources.filter((remote) => !localUUIDs.includes(remote[remoteIdField])),
  )

  // We try to automatically match sources if they have the same name and type,
  // by considering local sources which are missing on the remote side and
  // remote sources which are not synchronized locally.
  const {matched: matchedByNameAndType, pending: matchResult} = matchByNameAndType(
    pendingAfterMigratingFunctions.local,
    pendingAfterMigratingFunctions.remote,
    remoteIdField,
  )

  // Now we try to find a match between a local source and remote one if they have
  // the same type and they are unique even if they have different names. For example:
  // LOCAL_CHECKOUT_UI_NAMED_APPLE -> REMOTE_CHECKOUT_UI_NAMED_PEAR
  // LOCAL_PROD_SUBSCR_NAMED_ORANGE -> REMOTE_PROD_SUBSCR_NAMED_LEMON
  const {toConfirm, toCreate, pending} = matchByUniqueType(matchResult.local, matchResult.remote)

  return {
    identifiers: {...ids, ...matchedByNameAndType, ...migratedFunctions},
    toConfirm,
    toCreate,
    toManualMatch: pending,
  }
}

export function getExtensionIds(
  localSources: LocalSource[],
  identifiers: IdentifiersExtensions,
): IdentifiersExtensions {
  const localSourcesIds = localSources.map((source) => source.localIdentifier)

  return pickBy(identifiers, (_, id) => localSourcesIds.includes(id))
}
