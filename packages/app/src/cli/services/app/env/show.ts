import {AppInterface, getAppScopes} from '../../../models/app/app.js'
import {fetchAppFromConfigOrSelect} from '../fetch-app-from-config-or-select.js'
import {OutputMessage, outputContent, outputToken} from '@shopify/cli-kit/node/output'

type Format = 'json' | 'text'

export async function showEnv(app: AppInterface): Promise<OutputMessage> {
  return outputEnv(app, 'text')
}

export async function outputEnv(app: AppInterface, format: Format): Promise<OutputMessage> {
  const orgApp = await fetchAppFromConfigOrSelect(app)

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
