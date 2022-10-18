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

export async function automaticMatchmaking(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: {[localIdentifier: string]: string},
  remoteIdField: 'id' | 'uuid',
): Promise<Result<MatchResult, MatchingError>> {
  if (remoteSources.length > localSources.length) {
    return err('invalid-environment')
  }

  const validIdentifiers = identifiers

  const getLocalId = (local: LocalSource) => validIdentifiers[local.localIdentifier]
  const getLocalUUIDs = () => Object.values(validIdentifiers)
  const existsRemotely = (local: LocalSource) => {
    const remote = remoteSources.find((remote) => remote[remoteIdField] === getLocalId(local))
    return remote !== undefined && remote.type === local.graphQLType
  }

  // List of local sources that don't exists remotely and need to be matched
  const pendingLocal = localSources.filter((local) => !existsRemotely(local))

  // List of remote sources that are not yet matched to a local source
  const pendingRemote = remoteSources.filter((remote) => !getLocalUUIDs().includes(remote[remoteIdField]))

  // This is the list of remote sources with duplicated Type
  // If two or more sources have the same type, we need to manually match them.
  const remoteNeedsManualMatch = (() => {
    const types = pendingRemote.map((remote) => remote.type).filter((type, i, array) => array.indexOf(type) !== i)
    return pendingRemote.filter((remote) => types.includes(remote.type))
  })()

  // This is the list of local sources with duplicated Type
  // If two or more sources have the same type, we need to manually match them.
  const localNeedsManualMatch = (() => {
    const types = pendingLocal.map((local) => local.graphQLType).filter((type, i, array) => array.indexOf(type) !== i)
    // If local sources with duplicated types do not have a possible remote match, they don't require manual match
    const manualTypes = types.filter((type) => remoteNeedsManualMatch.some((remote) => remote.type === type))
    return pendingLocal.filter((local) => manualTypes.includes(local.graphQLType))
  })()

  // Sources we can match or create automatically should not contain duplicated types
  const newLocalPending = pendingLocal.filter((local) => !localNeedsManualMatch.includes(local))
  const newRemotePending = pendingRemote.filter((remote) => !remoteNeedsManualMatch.includes(remote))

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

  // First we need to do a pass to match sources with the same type and name.
  const matchByNameAndType = (pendingLocal: LocalSource[], pendingRemote: RemoteSource[]) => {
    pendingLocal.forEach((local) => {
      const possibleRemoteMatches = pendingRemote.filter((remote) => remote.type === local.graphQLType)
      for (const remoteMatch of possibleRemoteMatches) {
        if (string.slugify(remoteMatch.title) === string.slugify(local.configuration.name)) {
          // There is a unique remote source with the same type AND name. We can automatically match them!
          validIdentifiers[local.localIdentifier] = remoteMatch[remoteIdField]
          break
        }
      }
    })
    const unmatchedLocal = pendingLocal.filter((local) => !getLocalId(local))
    const unmatchedRemote = pendingRemote.filter((remote) => !getLocalUUIDs().includes(remote[remoteIdField]))
    return {unmatchedLocal, unmatchedRemote}
  }

  // Lists of sources that we couldn't match automatically
  const {unmatchedLocal, unmatchedRemote} = matchByNameAndType(newLocalPending, newRemotePending)

  const sourcesToCreate: LocalSource[] = []
  const pendingConfirmation: {local: LocalSource; remote: RemoteSource}[] = []

  // For each unmatched local source, evaluate if it can be manually matched or needs to be created
  unmatchedLocal.forEach((local) => {
    // Remote sources that have the same type as the local one
    const possibleMatches = unmatchedRemote.filter((req) => req.type === local.graphQLType)

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
    identifiers: validIdentifiers,
    pendingConfirmation,
    toCreate: sourcesToCreate,
    toManualMatch: {local: localNeedsManualMatch, remote: remoteNeedsManualMatch},
  })
}
