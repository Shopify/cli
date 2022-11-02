import {MatchingError, RemoteSource} from './identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {err, ok, Result} from '@shopify/cli-kit/common/result'
import {string} from '@shopify/cli-kit'
import {difference, partition, pickBy, uniqBy, groupBy} from 'lodash-es'
import type {LocalSource} from './identifiers'

export interface MatchResult {
  identifiers: IdentifiersExtensions
  toConfirm: {local: LocalSource; remote: RemoteSource}[]
  toCreate: LocalSource[]
  toManualMatch: {local: LocalSource[]; remote: RemoteSource[]}
}

/**
 * Filter function to match a local and a remote source by type and name
 */
const sameTypeAndName = (local: LocalSource, remote: RemoteSource) => {
  return remote.type === local.graphQLType && string.slugify(remote.title) === string.slugify(local.configuration.name)
}

/**
 * Automatically match local and remote sources if they have the same type and name
 *
 * If multiple local or remote sources have the same type and name, they can't be matched automatically
 */
function matchByNameAndType(
  local: LocalSource[],
  remote: RemoteSource[],
  remoteIdField: 'id' | 'uuid',
): {matched: IdentifiersExtensions; pending: {local: LocalSource[]; remote: RemoteSource[]}} {
  const uniqueLocal = uniqBy(local, (elem) => [elem.graphQLType, elem.configuration.name])
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
  const localUnique = Object.values(pickBy(localGroups, (group, key) => group.length === 1)).flat()

  const remoteGroups = groupBy(remoteSources, 'type')
  const remoteUniqueMap = pickBy(remoteGroups, (group, key) => group.length === 1)

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
): Promise<Result<MatchResult, MatchingError>> {
  if (remoteSources.length > localSources.length) {
    return err('invalid-environment')
  }

  const localUUIDs = Object.values(identifiers)
  const existsRemotely = (local: LocalSource) => {
    return Boolean(
      remoteSources.find(
        (remote) => remote[remoteIdField] === identifiers[local.localIdentifier] && remote.type === local.graphQLType,
      ),
    )
  }

  // We try to automatically match sources if they have the same name and type,
  // by considering local sources which are missing on the remote side and
  // remote sources which are not synchronized locally.
  const {matched: matchedByNameAndType, pending: matchResult} = matchByNameAndType(
    localSources.filter((local) => !existsRemotely(local)),
    remoteSources.filter((remote) => !localUUIDs.includes(remote[remoteIdField])),
    remoteIdField,
  )

  // Now we try to find a match between a local source and remote one if they have
  // the same type and they are unique even if they have different names. For example:
  // LOCAL_CHECKOUT_UI_NAMED_APPLE -> REMOTE_CHECKOUT_UI_NAMED_PEAR
  // LOCAL_PROD_SUBSCR_NAMED_ORANGE -> REMOTE_PROD_SUBSCR_NAMED_LEMON
  const {toConfirm, toCreate, pending} = matchByUniqueType(matchResult.local, matchResult.remote)

  // If we still have remote sources with a type that's missing from the local sources,
  // or if we have more remote sources than local sources, we return an error
  const remoteUnmatched = pending.remote.filter(
    (remote) => !pending.local.map((local) => local.graphQLType).includes(remote.type),
  )
  if (remoteUnmatched.length > 0 || pending.remote.length > pending.local.length) {
    return err('invalid-environment')
  }

  // At this point, all sources are matched either automatically, manually or are new
  return ok({
    identifiers: {...identifiers, ...matchedByNameAndType},
    toConfirm,
    toCreate,
    toManualMatch: pending,
  })
}
