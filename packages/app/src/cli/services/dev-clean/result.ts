import {appDevCleanJsonOutputSchema, AppDevCleanResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export function renderDevCleanResult(result: AppDevCleanResult, format: 'json' | 'text'): void {
  if (format === 'json') {
    outputResult(appDevCleanJsonOutputSchema.encode(result))
    return
  }

  renderSuccess({
    headline: 'Dev preview stopped.',
    body: [
      `The dev preview has been stopped on ${result.storeDomain} and the app's active version has been restored.`,
      'You can start it again with',
      {command: 'shopify app dev'},
    ],
  })
}
