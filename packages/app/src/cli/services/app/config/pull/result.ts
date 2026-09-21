import {appConfigPullJsonOutputSchema, type AppConfigPullResult} from './types.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputResult} from '@shopify/cli-kit/node/output'
import {basename} from '@shopify/cli-kit/node/path'

export function renderAppConfigPullResult(result: AppConfigPullResult, format: 'json' | 'text'): void {
  if (format === 'json') {
    outputResult(appConfigPullJsonOutputSchema.encode(result))
    return
  }
  renderSuccess({
    headline: `Pulled latest configuration for "${result.configuration.name}"`,
    body: `Updated ${basename(result.configFile)} with the remote data.`,
  })
}
