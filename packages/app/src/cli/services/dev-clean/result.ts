import {appDevCleanJsonOutputSchema, AppDevCleanResult, DevCleanResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {extractMyshopifyHandle} from '@shopify/cli-kit/common/url'

export function renderDevCleanResult(result: DevCleanResult, format: 'json' | 'text'): void {
  if (format === 'json') {
    const publicResult: AppDevCleanResult = {
      status: result.status,
      app: result.app,
      storeDomain: extractMyshopifyHandle(result.storeHostname) ? result.storeHostname : null,
    }
    outputResult(appDevCleanJsonOutputSchema.encode(publicResult))
    return
  }

  renderSuccess({
    headline: 'Dev preview stopped.',
    body: [
      `The dev preview has been stopped on ${result.storeHostname} and the app's active version has been restored.`,
      'You can start it again with',
      {command: 'shopify app dev'},
    ],
  })
}
