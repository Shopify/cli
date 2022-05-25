import {App, Extension, Identifiers} from '../../models/app/app'
import {fetchAppExtensionRegistrations} from '../dev/fetch'
import {dotEnvFileNames} from '../../constants'
import {error} from '@shopify/cli-kit'
import {Abort} from '@shopify/cli-kit/src/error'

export interface EnsureDeploymentIdsPresenceOptions {
  app: App
  token: string
  appId: string
  envIdentifiers: Partial<Identifiers>
}

export async function ensureDeploymentIdsPresence(options: EnsureDeploymentIdsPresenceOptions): Promise<Identifiers> {
  const remoteSpecifications = await fetchAppExtensionRegistrations({token: options.token, apiKey: options.appId})
  const localExtensions: Extension[] = [...options.app.extensions.ui, ...options.app.extensions.function]
  const envIdentifiers = options.envIdentifiers

  const localId = (extension: Extension) => (envIdentifiers.extensions ?? {})[extension.localIdentifier]
  const hasLocalId = (extension: Extension) => localId(extension) !== undefined
  const allExtensionsHaveLocalId = localExtensions.every(hasLocalId)
  const existsRemotely = (extension: Extension) =>
    remoteSpecifications.app.extensionRegistrations.find((registration) => registration.uuid === localId(extension))
  const needsCreation = (extension: Extension) => {
    return !hasLocalId(extension) || !existsRemotely(extension)
  }

  const localExtensionsWithEnvIdentifiers = localExtensions.filter(hasLocalId)
  const localExtensionsWithoutEnvIdentifiers = localExtensions.filter((ext) => !hasLocalId(ext))
  const remoteSpecificationsContainAllLocalIds = Object.values(envIdentifiers.extensions ?? {}).every((extensionId) => {
    return remoteSpecifications.app.extensionRegistrations.find(({uuid}) => uuid === extensionId) !== undefined
  })
  const localExtensionsWithLocalIdButNotRemote = localExtensions.filter(
    (extension) => hasLocalId(extension) && !existsRemotely(extension),
  )

  let extensionsToCreate: Extension[]
  let error: error.Abort | undefined

  // Case 1: All local extensions have identifiers
  if (allExtensionsHaveLocalId) {
    // Case 1.1: All local ids exist in the remote specifications
    if (remoteSpecificationsContainAllLocalIds) {
      return {
        app: options.appId,
        extensions: envIdentifiers.extensions ?? {},
      }
      // Case 2.2: There's a mismatch we can't handle (ERROR)
    } else {
      const extensionNames = localExtensionsWithLocalIdButNotRemote
        .map((extension) => extension.localIdentifier)
        .join(', ')
      const extensionEnvVariables = localExtensionsWithLocalIdButNotRemote
        .map((extension) => extension.idEnvironmentVariableName)
        .join(', ')
      error = new Abort(
        `The extensions ${extensionNames} don't belong to the partners' app with API key ${options.appId}`,
        `Deploy to the right app, create a new app, or delete the keys ${extensionEnvVariables} from the project's ${dotEnvFileNames.production} file.`,
      )
    }
  } else {
  }

  if (error) {
    throw error
  }

  return {
    app: options.appId,
    extensions: {},
  }
}
