import {App, Identifiers} from '../../models/app/app'
import {fetchAppExtensionRegistrations} from '../dev/fetch'

export interface EnsureDeploymentIdsPresenceOptions {
  app: App
  token: string
  appId: string
}

export async function ensureDeploymentIdsPresence(options: EnsureDeploymentIdsPresenceOptions): Promise<Identifiers> {
  const extensionSpecifications = await fetchAppExtensionRegistrations({token: options.token, apiKey: options.appId})
  return {
    app: options.appId,
    extensions: {},
  }
}
