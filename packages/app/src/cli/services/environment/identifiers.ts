import {App, Extension, Identifiers} from '../../models/app/app'
import {fetchAppExtensionRegistrations} from '../dev/fetch'
import {error} from '@shopify/cli-kit'

const WrongExtensionNumberError = (remote: number, local: number) => {
  return new error.Abort(
    `This app has ${remote} registered extensions, but only ${local} are locally available.`,
    `Please check your local project or select a different app to deploy to`,
  )
}

const NoLocalExtensionsError = () => {
  return new error.Abort('There are no extensions to deploy')
}

const NoAutomaticMatch = () => {
  return new error.Abort(
    "We couldn't automatically match your local and remote extensions",
    `Please check your local project or select a different app to deploy to`,
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
  const remoteSpecifications = await fetchAppExtensionRegistrations({token: options.token, apiKey: options.appId})
  console.log(JSON.stringify(remoteSpecifications, null, 2))
  const localExtensions: Extension[] = [...options.app.extensions.ui, ...options.app.extensions.function]
  const remoteRegistrations: ExtensionRegistration[] = remoteSpecifications.app.extensionRegistrations

  const envIdentifiers = options.envIdentifiers ?? {extensions: {}}

  const localId = (extension: Extension) => (envIdentifiers.extensions ?? {})[extension.localIdentifier]
  const hasLocalId = (extension: Extension) => localId(extension) !== undefined
  const allExtensionsHaveLocalId = localExtensions.every(hasLocalId)

  const existsRemotely = (extension: Extension) => {
    const remote = remoteRegistrations.find((registration) => registration.uuid === localId(extension))
    return remote !== undefined && remote.type === extension.graphQLType
  }

  const needsCreation = (extension: Extension) => {
    return !hasLocalId(extension) || !existsRemotely(extension)
  }

  const remoteForID = (uuid: string) => {
    remoteRegistrations.find((registration) => registration.uuid === uuid)
  }

  const remoteTypeMatches = (ext: Extension) => remoteRegistrations.filter((reg) => reg.type === ext.graphQLType)

  // const canWeMatch = (extension: Extension) => {
  //   const possibleMatches = remoteTypeMatches(extension)
  //   if (possibleMatches.length === 0) {
  //     needsCreation(extension)
  //   } else if (possibleMatches.length > 1) {
  //     err = NoAutomaticMatch()
  //   } else {
  //     envIdentifiers.extensions![extension.localIdentifier] = possibleMatches[0].uuid
  //   }
  // }

  const localExtensionsWithEnvIdentifiers = localExtensions.filter(hasLocalId)
  const localExtensionsWithoutEnvIdentifiers = localExtensions.filter((ext) => !hasLocalId(ext))
  const localUUIDs = () => Object.values(envIdentifiers.extensions ?? {})
  const remoteUUIDs = remoteRegistrations.map((registration) => registration.uuid)
  // const remoteSpecificationsContainAllLocalIds = localUUIDs.every((extensionId) => remoteUUIDs.includes(extensionId))

  // These extensions should also be created?
  const localExtensionsWithLocalIdButNotRemote = localExtensions.filter(
    (extension) => hasLocalId(extension) && !existsRemotely(extension),
  )

  const extensionsToCreate: Extension[] = []
  let err: error.Abort | undefined

  if (localExtensions.length === 0) {
    err = NoLocalExtensionsError()
  }

  if (remoteSpecifications.app.extensionRegistrations.length > localExtensions.length) {
    // There are more remote extensions than local extensions. We can't handle this case
    err = WrongExtensionNumberError(remoteSpecifications.app.extensionRegistrations.length, localExtensions.length)
  }

  const alreadyLinkedExtensions: ExtensionRegistration[] = []
  const validExtensions: Extension[] = []

  const alreadyMatched = (extension: Extension, matches: ExtensionRegistration[]) =>
    localUUIDs().includes(matches[0].uuid)
  /**
   * For each local extension, evaluate if its already valid or we can automatically match it to a remote one.
   */
  localExtensions.forEach((extension) => {
    // Remote extensions that have the same type as the local one
    const possibleMatches = remoteTypeMatches(extension)

    // Local extension alreaedy exists, nothing to do
    if (existsRemotely(extension)) return

    if (possibleMatches.length === 0) {
      // There are not remote extensions with the same type. We need to create a new extension
      extensionsToCreate.push(extension)
    } else if (possibleMatches.length > 1) {
      // THere are multiple remote extensions with the same type. We can't automatically match
      err = NoAutomaticMatch()
    } else if (alreadyMatched(extension, possibleMatches)) {
      // There is a remote extension with the same type but is already linked to a locak extension.
      // We need to create a new extension
      extensionsToCreate.push(extension)
    } else {
      // There is a unique remote extension with the same type. We can automatically match them.
      envIdentifiers.extensions![extension.localIdentifier] = possibleMatches[0].uuid
    }
  })

  // // Case 1: All local extensions have identifiers
  // if (allExtensionsHaveLocalId) {
  //   // Case 1.1: All local ids exist in the remote specifications
  //   if (remoteSpecificationsContainAllLocalIds) {
  //     // WHAT HAPPENS IF THERE ARE MORE REMOTE THAN LOCAL?
  //     return {
  //       app: options.appId,
  //       extensions: envIdentifiers.extensions ?? {},
  //     }
  //     // Case 2.2: There's a mismatch we can't handle (ERROR)
  //   } else {
  //     const extensionNames = localExtensionsWithLocalIdButNotRemote
  //       .map((extension) => extension.localIdentifier)
  //       .join(', ')
  //     const extensionEnvVariables = localExtensionsWithLocalIdButNotRemote
  //       .map((extension) => extension.idEnvironmentVariableName)
  //       .join(', ')
  //     err = new error.Abort(
  //       `The extensions ${extensionNames} don't belong to the partners' app with API key ${options.appId}`,
  //       `Deploy to the right app, create a new app, or delete the keys ${extensionEnvVariables} from the project's ${dotEnvFileNames.production} file.`,
  //     )
  //   }
  // } else {
  //   console.log('OK')
  // }

  if (err) {
    throw err
  }

  console.log(JSON.stringify(envIdentifiers.extensions, null, 2))
  console.log(JSON.stringify(extensionsToCreate, null, 2))

  // CREATE EXTENSIONS
  throw new error.Abort('WAIT')

  return {
    app: options.appId,
    extensions: {},
  }
}
