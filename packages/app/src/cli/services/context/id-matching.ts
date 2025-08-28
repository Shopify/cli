import {RemoteSource, LocalSource} from './identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {groupBy, partition} from '@shopify/cli-kit/common/collection'
import {uniqBy, difference} from '@shopify/cli-kit/common/array'
import {pickBy} from '@shopify/cli-kit/common/object'
import {slugify} from '@shopify/cli-kit/common/string'
import {outputInfo} from '@shopify/cli-kit/node/output'
import colors from '@shopify/cli-kit/node/colors'

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
  const isSameType =
    remote.type.toLowerCase() === local.graphQLType.toLowerCase() ||
    remote.type.toLowerCase() === (local as ExtensionInstance).externalType.toLowerCase() ||
    remote.type.toLowerCase() === (local as ExtensionInstance).type.toLowerCase()

  // In this case, remote.title represents the remote handle.
  // This needs to be cleaned up in the future in the `AppModuleVersion` transformation
  return isSameType && slugify(remote.title) === slugify(local.handle)
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
function matchByUIDandUUID(
  local: LocalSource[],
  remote: RemoteSource[],
  ids: IdentifiersExtensions,
): {
  matched: IdentifiersExtensions
  toCreate: LocalSource[]
  toConfirm: {local: LocalSource; remote: RemoteSource}[]
  toManualMatch: {local: LocalSource[]; remote: RemoteSource[]}
} {
  const matchedByUID: IdentifiersExtensions = {}
  const pendingLocal: LocalSource[] = []
  const matchedByUUID: IdentifiersExtensions = {}

  // First, try to match by UID, then by UUID.
  // But only accept a UUID match if the ID for the remote source is empty, meaning is still pending migration.
  local.forEach((localSource) => {
    const matchByUID = remote.find((remoteSource) => remoteSource.id === localSource.uid)
    const matchByUUID = remote.find((remoteSource) => remoteSource.uuid === ids[localSource.localIdentifier])

    if (matchByUID) {
      matchedByUID[localSource.localIdentifier] = matchByUID.id
    } else if (matchByUUID && matchByUUID.id.length === 0) {
      matchedByUUID[localSource.localIdentifier] = matchByUUID.uuid
    } else {
      pendingLocal.push(localSource)
    }
  })

  // Remote source with a valid UID is not pending, shouldn't be tried to be matched by name/type.
  const pendingRemote = remote.filter(
    (remoteSource) =>
      !Object.values(matchedByUUID).includes(remoteSource.uuid) &&
      !Object.values(matchedByUID).includes(remoteSource.id) &&
      remoteSource.id.length === 0,
  )

  // Then, try to match by name and type as a last resort.
  const {matched: matchedByName, toCreate, toConfirm, toManualMatch} = matchByNameAndType(pendingLocal, pendingRemote)

  // List of modules that were matched using anything other than the UID, meaning that they are being migrated to dev dash
  const totalMatchedWithoutUID = {...matchedByUUID, ...matchedByName}
  const localMatchedWithoutUID = local.filter((localSource) => totalMatchedWithoutUID[localSource.localIdentifier])

  outputAddedIDs(localMatchedWithoutUID)

  return {
    matched: {...matchedByUID, ...totalMatchedWithoutUID},
    toCreate,
    toConfirm,
    toManualMatch,
  }
}

function outputAddedIDs(localMatchedWithoutUID: LocalSource[]) {
  if (localMatchedWithoutUID.length === 0) return
  const colorList = [colors.cyan, colors.magenta, colors.blue, colors.green, colors.yellow, colors.red]

  const maxHandleLength = localMatchedWithoutUID.reduce((max, local) => Math.max(max, local.handle.length), 0)
  outputInfo('Generating extension IDs\n')
  localMatchedWithoutUID.forEach((local, index) => {
    const color = colorList[index % colorList.length] ?? colors.white
    outputInfo(`${color(local.handle.padStart(maxHandleLength))} | Added ID: ${local.uid}`)
  })
  outputInfo('\n')
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

  const remoteWithNormalizedType = remoteSources.map((remote) => ({...remote, type: remote.type.toLowerCase()}))
  const remoteGroups = groupBy(remoteWithNormalizedType, 'type')
  const remoteUniqueMap = pickBy(remoteGroups, (group, _key) => group.length === 1)

  const toConfirm: {local: LocalSource; remote: RemoteSource}[] = []
  const toCreate: LocalSource[] = []

  // for every local source that has a unique type we either:
  // - find a corresponding unique remote source and ask the user to confirm
  // - create it from scratch
  for (const local of localUnique) {
    const remote = remoteUniqueMap[local.graphQLType.toLowerCase()]
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
    remoteWithNormalizedType,
    toConfirm.map((elem) => elem.remote),
  )
  const [localPending, localToCreate] = partition(localDuplicated, (local) =>
    remotePending.map((remote) => remote.type.toLowerCase()).includes(local.graphQLType.toLowerCase()),
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

  const local = localSources.filter((local) => !existsRemotely(local))
  const remote = remoteSources.filter((remote) => !localIds.includes(remote.uuid))

  const {matched, toCreate, toConfirm, toManualMatch} = useUuidMatching
    ? matchByUIDandUUID(localSources, remoteSources, ids)
    : matchByNameAndType(local, remote)

  return {
    identifiers: {...ids, ...matched},
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
