import {selectApp} from '../select-app.js'
import {AppInterface} from '../../../models/app/app.js'
import * as output from '@shopify/cli-kit/node/output'

type Format = 'json' | 'text'

export async function showEnv(app: AppInterface): Promise<output.OutputMessage> {
  return outputEnv(app, 'text')
}

export async function outputEnv(app: AppInterface, format: Format): Promise<output.OutputMessage> {
  const selectedApp = await selectApp()

  if (format === 'json') {
    return output.outputContent`${output.outputToken.json({
      SHOPIFY_API_KEY: selectedApp.apiKey,
      SHOPIFY_API_SECRET: selectedApp.apiSecretKeys[0]?.secret,
      SCOPES: app.configuration.scopes,
    })}`
  } else {
    return output.outputContent`
    ${output.outputToken.green('SHOPIFY_API_KEY')}=${selectedApp.apiKey}
    ${output.outputToken.green('SHOPIFY_API_SECRET')}=${selectedApp.apiSecretKeys[0]?.secret ?? ''}
    ${output.outputToken.green('SCOPES')}=${app.configuration.scopes}
  `
  }
}
