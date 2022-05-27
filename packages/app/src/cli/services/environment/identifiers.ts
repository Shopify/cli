import {App, Extension, Identifiers} from '../../models/app/app'
import {fetchAppExtensionRegistrations} from '../dev/fetch'
import {createExtension} from '../dev/create-extension'
import {error, session} from '@shopify/cli-kit'

const WrongExtensionNumberError = (remote: number, local: number) => {
  return new error.Abort(
    `This app has ${remote} registered extensions, but only ${local} are locally available.`,
    `Please check your local project or select a different app to deploy to`,
  )
}

const NoLocalExtensionsError = () => {
  return new error.Abort('There are no extensions to deploy')
}

const ManualMatchRequired = () => {
  return new error.Abort(
    'Manual matching is required',
    'We are working on a a manual solution for this case, coming soon!',
  )
}

const InvalidEnvironment = () => {
  return new error.Abort(
    "We couldn't automatically match your local and remote extensions",
    'Please check your local project or select a different app to deploy to',
  )
}

export interface EnsureDeploymentIdsPresenceOptions {
  app: App
  token: string
  appId: string
  envIdentifiers: Partial<Identifiers>
}

interface ExtensionRegistration {
  uuid: string
  type: string
  id: string
  title: string
}

export async function ensureDeploymentIdsPresence(options: EnsureDeploymentIdsPresenceOptions): Promise<Identifiers> {
  // All initial values both remote and local
  const remoteSpecifications = await fetchAppExtensionRegistrations({token: options.token, apiKey: options.appId})
  const remoteRegistrations: ExtensionRegistration[] = remoteSpecifications.app.extensionRegistrations
  let validIdentifiers = options.envIdentifiers.extensions ?? {}
  const localExtensions: Extension[] = [
    ...options.app.extensions.ui,
    ...options.app.extensions.function,
    ...options.app.extensions.theme,
  ]

  // We need local extensions to deploy
  if (localExtensions.length === 0) {
    throw NoLocalExtensionsError()
  }

  // If there are more remote extensions than local, then something is missing and we can't continue
  if (remoteRegistrations.length > localExtensions.length) {
    throw WrongExtensionNumberError(remoteRegistrations.length, localExtensions.length)
  }

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

  // From pending to be matched extensions, this is the list of extensions with duplicated Type
  // If two or more extensions have the same type, we need to manually match them.
  const localNeedsManualMatch = (() => {
    const types = pendingLocal.map((ext) => ext.graphQLType).filter((type, i, array) => array.indexOf(type) !== i)
    return pendingLocal.filter((ext) => types.includes(ext.graphQLType))
  })()

  // From pending to be matched remote extensions, this is the list of remote extensions with duplicated Type
  // If two or more extensions have the same type, we need to manually match them.
  const remoteNeedsManualMatch = (() => {
    const types = pendingRemote.map((ext) => ext.type).filter((type, i, array) => array.indexOf(type) !== i)
    return pendingRemote.filter((ext) => types.includes(ext.type))
  })()

  // Extensions that should be possible to automatically match or create, should not contain duplicated types
  const newLocalPending = pendingLocal.filter((extension) => !localNeedsManualMatch.includes(extension))
  const newRemotePending = pendingRemote.filter((registration) => !remoteNeedsManualMatch.includes(registration))

  // If there are remote pending with types not present locally, we can't automatically match
  // The user must solve the issue in their environment or deploy to a different app
  const impossible = newRemotePending.filter((reg) => !newLocalPending.map((ext) => ext.graphQLType).includes(reg.type))
  if (impossible.length > 0 || newRemotePending.length > newLocalPending.length) {
    throw InvalidEnvironment()
  }

  // If there are more remote pending than local in total, then we can't automatically match
  // The user must solve the issue in their environment or deploy to a different app
  if (newRemotePending.length > newLocalPending.length) {
    throw InvalidEnvironment()
  }

  const extensionsToCreate: Extension[] = []

  // For each pending local extension, evaluate if it can be automatically matched or needs to be created
  newLocalPending.forEach((extension) => {
    // Remote extensions that have the same type as the local one
    const possibleMatches = newRemotePending.filter((req) => req.type === extension.graphQLType)

    if (possibleMatches.length === 0) {
      // There are no remote extensions with the same type. We need to create a new extension
      extensionsToCreate.push(extension)
    } else {
      // There is a unique remote extension with the same type. We can automatically match them.
      validIdentifiers[extension.localIdentifier] = possibleMatches[0].uuid
    }
  })

  // Create all extensions that need to be created
  if (extensionsToCreate.length > 0) {
    // const newIdentifiers = await createExtensions(extensionsToCreate, options.appId)
    // validIdentifiers = {...validIdentifiers, ...newIdentifiers}
  }

  if (localNeedsManualMatch.length > 0) {
    // PENDING: Check that there are no more remote extenions that local pending to be manually matched
    // PENDING: Manually match pending extensions
    throw ManualMatchRequired()
  }

  // PENDING: Function extensions can't be created before being deployed we'll need to handle that differently

  // At this point, all extensions are matched either automatically, manually or are new
  return {
    app: options.appId,
    extensions: validIdentifiers,
  }
}

async function createExtensions(extensions: Extension[], appId: string) {
  const token = await session.ensureAuthenticatedPartners()
  const result: {[localIdentifier: string]: string} = {}
  for (const extension of extensions) {
    // eslint-disable-next-line no-await-in-loop
    const registration = await createExtension(appId, extension.type, extension.localIdentifier, token)
    result[extension.localIdentifier] = registration.uuid
  }
  return result
}
