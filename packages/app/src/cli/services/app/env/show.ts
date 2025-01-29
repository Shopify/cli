import {AppInterface, getAppScopes} from '../../../models/app/app.js'
import {Organization, OrganizationApp} from '../../../models/organization.js'
import {logMetadataForLoadedContext} from '../../context.js'
import {OutputMessage, outputContent, outputToken} from '@shopify/cli-kit/node/output'

type Format = 'json' | 'text'

export async function showEnv(
  app: AppInterface,
  remoteApp: OrganizationApp,
  organization: Organization,
): Promise<OutputMessage> {
  return outputEnv(app, remoteApp, organization, 'text')
}

export async function outputEnv(
  app: AppInterface,
  remoteApp: OrganizationApp,
  organization: Organization,
  format: Format,
): Promise<OutputMessage> {
  await logMetadataForLoadedContext(remoteApp, organization.source)

  if (format === 'json') {
    return outputContent`${outputToken.json({
      SHOPIFY_API_KEY: remoteApp.apiKey,
      SHOPIFY_API_SECRET: remoteApp.apiSecretKeys[0]?.secret,
      SCOPES: getAppScopes(app.configuration),
    })}`
  } else {
    return outputContent`
    ${outputToken.green('SHOPIFY_API_KEY')}=${remoteApp.apiKey}
    ${outputToken.green('SHOPIFY_API_SECRET')}=${remoteApp.apiSecretKeys[0]?.secret ?? ''}
    ${outputToken.green('SCOPES')}=${getAppScopes(app.configuration)}
  `
  }
}
