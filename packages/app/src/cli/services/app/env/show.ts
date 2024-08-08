import {AppInterface, getAppScopes} from '../../../models/app/app.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {logMetadataForLoadedContext} from '../../context.js'
import {fetchAppFromConfigOrSelect} from '../fetch-app-from-config-or-select.js'
import {OutputMessage, outputContent, outputToken} from '@shopify/cli-kit/node/output'

type Format = 'json' | 'text'

export async function showEnv(
  app: AppInterface,
  developerPlatformClient: DeveloperPlatformClient = selectDeveloperPlatformClient({configuration: app.configuration}),
): Promise<OutputMessage> {
  return outputEnv(app, 'text', developerPlatformClient)
}

export async function outputEnv(
  app: AppInterface,
  format: Format,
  developerPlatformClient: DeveloperPlatformClient = selectDeveloperPlatformClient({configuration: app.configuration}),
): Promise<OutputMessage> {
  const orgApp = await fetchAppFromConfigOrSelect(app, developerPlatformClient)

  await logMetadataForLoadedContext(orgApp)

  if (format === 'json') {
    return outputContent`${outputToken.json({
      SHOPIFY_API_KEY: orgApp.apiKey,
      SHOPIFY_API_SECRET: orgApp.apiSecretKeys[0]?.secret,
      SCOPES: getAppScopes(app.configuration),
    })}`
  } else {
    return outputContent`
    ${outputToken.green('SHOPIFY_API_KEY')}=${orgApp.apiKey}
    ${outputToken.green('SHOPIFY_API_SECRET')}=${orgApp.apiSecretKeys[0]?.secret ?? ''}
    ${outputToken.green('SCOPES')}=${getAppScopes(app.configuration)}
  `
  }
}
