import {ExtensionRegistration} from '../dev/create-extension.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {err, ok, Result} from '@shopify/cli-kit/common/result'
import {error, string} from '@shopify/cli-kit'
import {ExtensionTypes} from '../../constants.js'
import {MatchingError, RemoteRegistration} from './identifiers.js'

export interface MatchResult {
  identifiers: IdentifiersExtensions
  pendingConfirmation: {extension: LocalExtension; registration: ExtensionRegistration}[]
  toCreate: LocalExtension[]
  toManualMatch: {local: LocalExtension[]; remote: ExtensionRegistration[]}
}

export interface LocalExtension {
  localIdentifier: string
  graphQLType: string
  type: ExtensionTypes
  configuration: {name: string}
}

export async function automaticMatchmaking(
  localExtensions: LocalExtension[],
  remoteRegistrations: ExtensionRegistration[],
  identifiers: {[localIdentifier: string]: string},
  registrationIdField: 'id' | 'uuid',
): Promise<Result<MatchResult, MatchingError>> {
  if (remoteRegistrations.length > localExtensions.length) {
    return err('invalid-environment')
  }

  const validIdentifiers = identifiers

  // Get the local UUID of an extension, if exists
  const localId = (extension: LocalExtension) => validIdentifiers[extension.localIdentifier]

  // All local UUIDs available
  const localUUIDs = () => Object.values(validIdentifiers)

  // Whether an extension has an UUID and that UUID and type match with a remote extension
  const existsRemotely = (extension: LocalExtension) => {
    const remote = remoteRegistrations.find((registration) => registration[registrationIdField] === localId(extension))
    return remote !== undefined && remote.type === extension.graphQLType
  }

  // List of local extensions that don't exists remotely and need to be matched
  const pendingLocal = localExtensions.filter((extension) => !existsRemotely(extension))

  // List of remote extensions that are not yet matched to a local extension
  const pendingRemote = remoteRegistrations.filter(
    (registration) => !localUUIDs().includes(registration[registrationIdField]),
  )

  // From pending to be matched remote extensions, this is the list of remote extensions with duplicated Type
  // If two or more extensions have the same type, we need to manually match them.
  const remoteNeedsManualMatch = (() => {
    const types = pendingRemote.map((ext) => ext.type).filter((type, i, array) => array.indexOf(type) !== i)
    return pendingRemote.filter((ext) => types.includes(ext.type))
  })()

  // From pending to be matched extensions, this is the list of extensions with duplicated Type
  // If two or more extensions have the same type, we need to manually match them.
  const localNeedsManualMatch = (() => {
    const types = pendingLocal.map((ext) => ext.graphQLType).filter((type, i, array) => array.indexOf(type) !== i)
    // If local extensions with duplicated types do not have a possible remote match, they don't require manual match
    const manualTypes = types.filter((type) => remoteNeedsManualMatch.some((reg) => reg.type === type))
    return pendingLocal.filter((ext) => manualTypes.includes(ext.graphQLType))
  })()

  // Extensions that should be possible to automatically match or create, should not contain duplicated types
  const newLocalPending = pendingLocal.filter((extension) => !localNeedsManualMatch.includes(extension))
  const newRemotePending = pendingRemote.filter((registration) => !remoteNeedsManualMatch.includes(registration))

  // If there are remote pending with types not present locally, we can't automatically match
  // The user must solve the issue in their environment or deploy to a different app
  const impossible = newRemotePending.filter((reg) => !newLocalPending.map((ext) => ext.graphQLType).includes(reg.type))
  if (impossible.length > 0 || newRemotePending.length > newLocalPending.length) {
    return err('invalid-environment')
  }

  // If there are more remote pending than local in total, then we can't automatically match
  // The user must solve the issue in their environment or deploy to a different app
  if (newRemotePending.length > newLocalPending.length) {
    return err('invalid-environment')
  }

  // First we need to do a pass to match extensions with the same type and name.
  const matchByNameAndType = (pendingLocal: LocalExtension[], pendingRemote: RemoteRegistration[]) => {
    pendingLocal.forEach((extension) => {
      const possibleMatches = pendingRemote.filter((req) => req.type === extension.graphQLType)
      for (const match of possibleMatches) {
        if (string.slugify(match.title) === string.slugify(extension.configuration.name)) {
          // There is a unique remote extension with the same type AND name. We can automatically match them.
          validIdentifiers[extension.localIdentifier] = match![registrationIdField]
          break
        }
      }
    })
    const unmatchedLocal = pendingLocal.filter((extension) => !localId(extension))
    const unmatchedRemote = pendingRemote.filter((reg) => !localUUIDs().includes(reg[registrationIdField]))
    return {unmatchedLocal, unmatchedRemote}
  }

  // Lists of extensions that we couldn't match automatically
  const {unmatchedLocal, unmatchedRemote} = matchByNameAndType(newLocalPending, newRemotePending)

  const extensionsToCreate: LocalExtension[] = []
  const pendingConfirmation: {extension: LocalExtension; registration: ExtensionRegistration}[] = []

  // For each unmatched local extension, evaluate if it can be manually matched or needs to be created
  unmatchedLocal.forEach((extension) => {
    // Remote extensions that have the same type as the local one
    const possibleMatches = unmatchedRemote.filter((req) => req.type === extension.graphQLType)

    if (possibleMatches.length === 0) {
      // There are no remote extensions with the same type. We need to create a new extension
      extensionsToCreate.push(extension)
    } else if (possibleMatches.length === 1) {
      // There is a unique remote extension with the same type, but different name. We can match them but need to confirm
      pendingConfirmation.push({extension, registration: possibleMatches[0]!})
    } else {
      // At this point we've already filtered out any duplicated type, we shouldn't have more than 1 possible match
      throw new error.Bug(
        `We detected multiple extension matches. This shouldn't happen.
        Please report it at https://github.com/Shopify/cli/issues/new/choose`,
      )
    }
  })

  // At this point, all extensions are matched either automatically, manually or are new
  return ok({
    identifiers: validIdentifiers,
    pendingConfirmation,
    toCreate: extensionsToCreate,
    toManualMatch: {local: localNeedsManualMatch, remote: remoteNeedsManualMatch},
  })
}
