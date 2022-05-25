import {App, Extension, Identifiers} from '../../models/app/app'
import {fetchAppExtensionRegistrations} from '../dev/fetch'

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

  const extensionsToCreate: Extension[] = localExtensions.filter(needsCreation)

  // Case 1: All local extensions have identifiers
  if (localExtensionsWithEnvIdentifiers.length === localExtensions.length) {
    // Case 1.1: All local ids exist in the remote specifications
    if (remoteSpecificationsContainAllLocalIds) {
      return {
        app: options.appId,
        extensions: envIdentifiers.extensions ?? {},
      }
      // Case 2.2: Some extensions need to be created
    }
    // Case 2.2: Some extensions need to be created
  }

  const extensionsIdentifiers: Identifiers = {...envIdentifiers}
  return {
    app: options.appId,
    extensions: extensionsIdentifiers,
  }
}
