import {LocalSource} from './identifiers'
import {MatchingError, RemoteSource} from './identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {err, ok, Result} from '@shopify/cli-kit/common/result'
import {error, string} from '@shopify/cli-kit'

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
 * Find unique local sources (with a unique union of type and name)
 */
const findUniqueLocal = (localSources: LocalSource[]) => {
  return localSources.filter((local) => {
    return (
      localSources.filter(
        (elem) => elem.graphQLType === local.graphQLType && elem.configuration.name === local.configuration.name,
      ).length === 1
    )
  })
}

/**
 * Find unique remote sources (with a unique union of type and name)
 */
const findUniqueRemote = (remoteSources: RemoteSource[]) => {
  return remoteSources.filter((remote) => {
    return remoteSources.filter((elem) => elem.type === remote.type && elem.title === remote.title).length === 1
  })
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
  const uniqueLocal = findUniqueLocal(local)
  const uniqueRemote = findUniqueRemote(remote)
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

  // This is the list of remote sources with duplicated Type.
  // If two or more sources have the same type, we need to manually match them.
  const remoteNeedsManualMatch = (() => {
    const types = pending.remote.map((remote) => remote.type).filter((type, i, array) => array.indexOf(type) !== i)
    return pending.remote.filter((remote) => types.includes(remote.type))
  })()

  // This is the list of local sources with duplicated Type.
  // If two or more sources have the same type, we need to manually match them.
  const localNeedsManualMatch = (() => {
    const types = pending.local.map((local) => local.graphQLType).filter((type, i, array) => array.indexOf(type) !== i)
    // If local extensions with duplicated types do not have a possible remote match, they need to be created
    const manualTypes = types.filter((type) => remoteNeedsManualMatch.some((reg) => reg.type === type))
    return pending.local.filter((local) => manualTypes.includes(local.graphQLType))
  })()

  // Sources we can match or create automatically should not contain duplicated types
  const newLocalPending = pending.local.filter((local) => !localNeedsManualMatch.includes(local))
  const newRemotePending = pending.remote.filter((remote) => !remoteNeedsManualMatch.includes(remote))

  // If there are remote pending with types not present locally, we can't automatically match
  // The user must solve the issue in their environment or deploy to a different app
  const impossible = newRemotePending.filter(
    (remote) => !newLocalPending.map((local) => local.graphQLType).includes(remote.type),
  )
  if (impossible.length > 0 || newRemotePending.length > newLocalPending.length) {
    return err('invalid-environment')
  }

  // If there are more remote pending than local in total, then we can't automatically match
  // The user must solve the issue in their environment or deploy to a different app
  if (newRemotePending.length > newLocalPending.length) {
    return err('invalid-environment')
  }

  const sourcesToCreate: LocalSource[] = []
  const pendingConfirmation: {local: LocalSource; remote: RemoteSource}[] = []

  // For each unmatched local source, evaluate if it can be manually matched or needs to be created
  newLocalPending.forEach((local) => {
    // Remote sources that have the same type as the local one
    const possibleMatches = newRemotePending.filter((req) => req.type === local.graphQLType)

    if (possibleMatches.length === 0) {
      // There are no remote sources with the same type. We need to create a new one
      sourcesToCreate.push(local)
    } else if (possibleMatches.length === 1) {
      // There is a unique remote source with the same type, but different name. We can match them but need to confirm
      pendingConfirmation.push({local, remote: possibleMatches[0]!})
    } else {
      // At this point we've already filtered out any duplicated type, we shouldn't have more than 1 possible match
      throw new error.Bug(
        `We detected multiple extension matches. This shouldn't happen.
        Please report it at https://github.com/Shopify/cli/issues/new/choose`,
      )
    }
  })

  // At this point, all sources are matched either automatically, manually or are new
  return ok({
    identifiers: {...identifiers, ...matched},
    pendingConfirmation,
    toCreate: sourcesToCreate,
    toManualMatch: {local: localNeedsManualMatch, remote: remoteNeedsManualMatch},
  })
}
