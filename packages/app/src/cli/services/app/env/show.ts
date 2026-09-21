import {type AppEnvShowResult} from './show/types.js'
import {AppInterface, getAppScopes} from '../../../models/app/app.js'
import {Organization, OrganizationApp} from '../../../models/organization.js'
import {logMetadataForLoadedContext} from '../../context.js'

export async function getAppEnv(
  app: AppInterface,
  remoteApp: OrganizationApp,
  organization: Organization,
): Promise<AppEnvShowResult> {
  // Deliberate side effect: records analytics metadata for the loaded app.
  await logMetadataForLoadedContext(remoteApp, organization.source)
  return {
    SHOPIFY_API_KEY: remoteApp.apiKey,
    ...(remoteApp.apiSecretKeys[0] ? {SHOPIFY_API_SECRET: remoteApp.apiSecretKeys[0].secret} : {}),
    SCOPES: getAppScopes(app.configuration),
  }
}
