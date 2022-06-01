import {ExtensionRegistration} from '../dev/create-extension'
import {Extension, IdentifiersExtensions} from 'cli/models/app/app'

export type MatchResult =
  | {
      result: 'ok'
      identifiers: IdentifiersExtensions
      pendingConfirmation: {extension: Extension; registration: ExtensionRegistration}[]
      toCreate: Extension[]
      toManualMatch: {local: Extension[]; remote: ExtensionRegistration[]}
    }
  | {
      result: 'invalid-environment'
    }

export async function automaticMatchmaking(
  localExtensions: Extension[],
  remoteRegistrations: ExtensionRegistration[],
  identifiers: {[localIdentifier: string]: string},
): Promise<MatchResult> {
  if (remoteRegistrations.length > localExtensions.length) {
    return {result: 'invalid-environment'}
  }

  const validIdentifiers = identifiers

  // Get the local UUID of an extension, if exists
  const localId = (extension: Extension) => validIdentifiers[extension.localIdentifier]

  // All local UUIDs available
  const localUUIDs = () => Object.values(validIdentifiers)

  // Whether an extension has an UUID and that UUID and type match with a remote extension
  const existsRemotely = (extension: Extension) => {
    const remote = remoteRegistrations.find((registration) => registration.uuid === localId(extension))
    return remote !== undefined && remote.type === extension.graphQLType
  }

  // List of local extensions that don't exists remotely and need to be matched
  const pendingLocal = localExtensions.filter((extension) => !existsRemotely(extension))

  // List of remote extensions that are not yet matched to a local extension
  const pendingRemote = remoteRegistrations.filter((registration) => !localUUIDs().includes(registration.uuid))

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
    return {result: 'invalid-environment'}
  }

  // If there are more remote pending than local in total, then we can't automatically match
  // The user must solve the issue in their environment or deploy to a different app
  if (newRemotePending.length > newLocalPending.length) {
    return {result: 'invalid-environment'}
  }

  const extensionsToCreate: Extension[] = []
  const pendingConfirmation: {extension: Extension; registration: ExtensionRegistration}[] = []

  // For each pending local extension, evaluate if it can be automatically matched or needs to be created
  newLocalPending.forEach((extension) => {
    // Remote extensions that have the same type as the local one
    const possibleMatches = newRemotePending.filter((req) => req.type === extension.graphQLType)

    if (possibleMatches.length === 0) {
      // There are no remote extensions with the same type. We need to create a new extension
      extensionsToCreate.push(extension)
    } else if (possibleMatches[0].title.toLowerCase() === extension.localIdentifier.toLowerCase()) {
      // There is a unique remote extension with the same type AND name. We can automatically match them.
      validIdentifiers[extension.localIdentifier] = possibleMatches[0].uuid
    } else {
      // There is a unique remote extension with the same type, but different name. We can match them but need to confirm
      pendingConfirmation.push({extension, registration: possibleMatches[0]})
    }
  })

  // At this point, all extensions are matched either automatically, manually or are new
  return {
    result: 'ok',
    identifiers: validIdentifiers,
    pendingConfirmation,
    toCreate: extensionsToCreate,
    toManualMatch: {local: localNeedsManualMatch, remote: remoteNeedsManualMatch},
  }
}
