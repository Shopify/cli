import {openStoreJsonOutputSchema, type OpenStoreResult} from './types.js'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'

export function renderOpenStoreResult(result: OpenStoreResult, format: 'text' | 'json'): void {
  if (format === 'json') {
    outputResult(openStoreJsonOutputSchema.encode(result))
    return
  }

  if (result.opened) {
    renderInfo({headline: `Opening the storefront for ${result.store} in your browser.`})
    return
  }

  renderInfo({
    headline: `Browser didn't open automatically. Open the storefront manually:`,
    body: [outputContent`${outputToken.link(result.url, result.url)}`.value],
  })
}
