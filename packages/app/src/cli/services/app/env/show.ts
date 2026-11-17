import {AppInterface, getAppScopes} from '../../../models/app/app.js'
import {
  Organization,
  OrganizationApp,
  fetchAppClientSecret,
  warnClientSecretOmitted,
} from '../../../models/organization.js'
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

async function outputEnv(
  app: AppInterface,
  remoteApp: OrganizationApp,
  organization: Organization,
  format: Format,
): Promise<OutputMessage> {
  await logMetadataForLoadedContext(remoteApp, organization.source)
  const apiSecret = await fetchAppClientSecret(remoteApp)
  if (!apiSecret) warnClientSecretOmitted()

  if (format === 'json') {
    return outputContent`${outputToken.json({
      SHOPIFY_API_KEY: remoteApp.apiKey,
      SHOPIFY_API_SECRET: apiSecret,
      SCOPES: getAppScopes(app.configuration),
    })}`
  } else {
    return outputContent`
    ${outputToken.green('SHOPIFY_API_KEY')}=${remoteApp.apiKey}
    ${outputToken.green('SHOPIFY_API_SECRET')}=${apiSecret ?? ''}
    ${outputToken.green('SCOPES')}=${getAppScopes(app.configuration)}
  `
  }
}
