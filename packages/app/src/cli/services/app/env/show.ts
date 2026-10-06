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
    variables: [
      {name: 'SHOPIFY_API_KEY', value: remoteApp.apiKey, isSecret: false},
      ...(remoteApp.apiSecretKeys[0]
        ? [{name: 'SHOPIFY_API_SECRET', value: remoteApp.apiSecretKeys[0].secret, isSecret: true}]
        : []),
      {name: 'SCOPES', value: getAppScopes(app.configuration), isSecret: false},
    ],
  }
}
