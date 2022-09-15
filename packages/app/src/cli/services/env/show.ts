import {selectApp} from '../app/select-app.js'
import {AppInterface} from '../../models/app/app.js'
import {output} from '@shopify/cli-kit'

type Format = 'json' | 'text'

export async function showEnv(app: AppInterface): Promise<output.Message> {
  return outputEnv(app, 'text')
}

export async function outputEnv(app: AppInterface, format: Format): Promise<output.Message> {
  const selectedApp = await selectApp()

  if (format === 'json') {
    return output.content`${output.token.json({
      SHOPIFY_API_KEY: selectedApp.apiKey,
      SHOPIFY_API_SECRET: selectedApp.apiSecretKeys[0]?.secret,
      SCOPES: app.configuration.scopes,
    })}`
  } else {
    return output.content`
    ${output.token.green('SHOPIFY_API_KEY')}=${selectedApp.apiKey}
    ${output.token.green('SHOPIFY_API_SECRET')}=${selectedApp.apiSecretKeys[0]?.secret ?? ''}
    ${output.token.green('SCOPES')}=${app.configuration.scopes}
  `
  }
}
