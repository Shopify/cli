import {LocalSource} from './identifiers'
import {MatchingError, RemoteSource} from './identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {err, ok, Result} from '@shopify/cli-kit/common/result'
import {string} from '@shopify/cli-kit'
import {difference, flatten, partition, pickBy, values, uniqBy, groupBy} from 'lodash-es'

export interface MatchResult {
  identifiers: IdentifiersExtensions
  pendingConfirmation: {local: LocalSource; remote: RemoteSource}[]
  toCreate: LocalSource[]
  toManualMatch: {local: LocalSource[]; remote: RemoteSource[]}
}

/*
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
    const remote = remoteSources.find((remote) => remote[remoteIdField] === identifiers[local.localIdentifier])
    return remote !== undefined && remote.type === local.graphQLType
  }

  // We try to automatically match sources if they have the same name and type,
  // by considering local sources which are missing on the remote side and
  // remote sources which are not synchronized locally.
  const {matched, pending} = matchByNameAndType(
    localSources.filter((local) => !existsRemotely(local)),
    remoteSources.filter((remote) => !localUUIDs.includes(remote[remoteIdField])),
    remoteIdField,
  )

  const pendingConfirmation: {local: LocalSource; remote: RemoteSource}[] = []
  const sourcesToCreate: LocalSource[] = []

  const localGroups = groupBy(pending.local, 'graphQLType')
  const localUnique = flatten(values(pickBy(localGroups, (group, key) => group.length === 1)))

  const remoteGroups = groupBy(pending.remote, 'type')
  const remoteUnique = pickBy(remoteGroups, (group, key) => group.length === 1)

  for (const local of localUnique) {
    const remote = remoteUnique[local.graphQLType]
    if (remote && remote[0]) {
      pendingConfirmation.push({local, remote: remote[0]})
    } else {
      sourcesToCreate.push(local)
    }
  }

  let newLocalPending = difference(pending.local, localUnique)
  const newRemotePending = difference(
    pending.remote,
    pendingConfirmation.map((elem) => elem.remote),
  )
  const [localPending, toCreate] = partition(newLocalPending, (local) =>
    newRemotePending.map((remote) => remote.type).includes(local.graphQLType),
  )
  sourcesToCreate.push(...toCreate)
  newLocalPending = localPending

  const impossible = newRemotePending.filter(
    (remote) => !newLocalPending.map((local) => local.graphQLType).includes(remote.type),
  )
  if (impossible.length > 0 || newRemotePending.length > newLocalPending.length) {
    return err('invalid-environment')
  }

  // At this point, all sources are matched either automatically, manually or are new
  return ok({
    identifiers: {...identifiers, ...matched},
    pendingConfirmation,
    toCreate: sourcesToCreate,
    toManualMatch: {local: newLocalPending, remote: newRemotePending},
  })
}
