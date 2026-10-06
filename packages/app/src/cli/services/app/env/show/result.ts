import {appEnvShowJsonOutputSchema, type AppEnvShowResult} from './types.js'
import {OutputMessage, outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'

export function formatAppEnvShowText(result: AppEnvShowResult): OutputMessage {
  const values = Object.fromEntries(result.variables.map(({name, value}) => [name, value]))
  return outputContent`
    ${outputToken.green('SHOPIFY_API_KEY')}=${values.SHOPIFY_API_KEY ?? ''}
    ${outputToken.green('SHOPIFY_API_SECRET')}=${values.SHOPIFY_API_SECRET ?? ''}
    ${outputToken.green('SCOPES')}=${values.SCOPES ?? ''}
  `
}

export function renderAppEnvShowResult(result: AppEnvShowResult, format: 'json' | 'text'): void {
  outputResult(format === 'json' ? appEnvShowJsonOutputSchema.encode(result) : formatAppEnvShowText(result))
}
