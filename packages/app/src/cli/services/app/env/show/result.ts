import {appEnvShowJsonOutputSchema, type AppEnvShowResult} from './types.js'
import {OutputMessage, outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'

export function formatAppEnvShowText(result: AppEnvShowResult): OutputMessage {
  return outputContent`
    ${outputToken.green('SHOPIFY_API_KEY')}=${result.SHOPIFY_API_KEY}
    ${outputToken.green('SHOPIFY_API_SECRET')}=${result.SHOPIFY_API_SECRET ?? ''}
    ${outputToken.green('SCOPES')}=${result.SCOPES}
  `
}

export function renderAppEnvShowResult(result: AppEnvShowResult, format: 'json' | 'text'): void {
  outputResult(format === 'json' ? appEnvShowJsonOutputSchema.encode(result) : formatAppEnvShowText(result))
}
