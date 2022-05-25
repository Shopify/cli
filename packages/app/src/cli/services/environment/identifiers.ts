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
  const localExtensionsWithEnvIdentifiers = localExtensions.filter(
    (extension) => (envIdentifiers.extensions ?? {})[extension.localIdentifier] !== undefined,
  )
  const localExtensionsWithoutEnvIdentifiers = localExtensions.filter(
    (extension) => (envIdentifiers.extensions ?? {})[extension.localIdentifier] === undefined,
  )
  const remoteSpecificationsContainAllLocalIds = Object.values(envIdentifiers.extensions ?? {}).every((extensionId) => {
    return remoteSpecifications.app.extensionRegistrations.includes(({uuid}) => uuid === extensionId)
  })

  // Case: All local extensions have identifiers
  if (localExtensionsWithEnvIdentifiers.length === localExtensions.length) {
    return {
      app: options.appId,
      extensions: envIdentifiers.extensions ?? {},
    }
  }

  return {
    app: options.appId,
    extensions: {},
  }
}
