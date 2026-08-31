import {storeAuthListJsonOutputSchema, type StoreAuthListResult} from './list-types.js'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'

export function writeStoreAuthListResult(result: StoreAuthListResult, format: 'text' | 'json'): void {
  if (format === 'json') {
    outputResult(storeAuthListJsonOutputSchema.encode(result))
    return
  }

  renderTextResult(result)
}

function renderTextResult(result: StoreAuthListResult): void {
  if (result.sessions.length === 0) {
    outputInfo(result.message ?? '')
    return
  }

  renderTable({
    rows: result.sessions,
    columns: {
      subdomain: {header: 'Subdomain'},
      connected: {header: 'Connected'},
    },
  })
}
