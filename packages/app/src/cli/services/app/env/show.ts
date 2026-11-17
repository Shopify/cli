import {type AppEnvShowResult} from './show/types.js'
import {AppInterface, getAppScopes} from '../../../models/app/app.js'
import {
  Organization,
  OrganizationApp,
  fetchAppClientSecret,
  warnClientSecretOmitted,
} from '../../../models/organization.js'
import {logMetadataForLoadedContext} from '../../context.js'

export async function getAppEnv(
  app: AppInterface,
  remoteApp: OrganizationApp,
  organization: Organization,
): Promise<AppEnvShowResult> {
  // Deliberate side effect: records analytics metadata for the loaded app.
  await logMetadataForLoadedContext(remoteApp, organization.source)
  const apiSecret = await fetchAppClientSecret(remoteApp)
  if (!apiSecret) warnClientSecretOmitted()
  return {
    variables: [
      {name: 'SHOPIFY_API_KEY', value: remoteApp.apiKey, isSecret: false},
      // Without a value, the entry tells JSON consumers that the secret exists but wasn't returned.
      apiSecret
        ? {name: 'SHOPIFY_API_SECRET', value: apiSecret, isSecret: true}
        : {name: 'SHOPIFY_API_SECRET', isSecret: true},
      {name: 'SCOPES', value: getAppScopes(app.configuration), isSecret: false},
    ],
  }
}
