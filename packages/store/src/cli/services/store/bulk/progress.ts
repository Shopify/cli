import {formatOperationInfo} from './common.js'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'

export function logBulkOperationStart(
  headline: string,
  context: {storeFqdn: string; version?: string; operationId?: string},
  format: 'text' | 'json',
): void {
  const items = [...(context.operationId ? [`ID: ${context.operationId}`] : []), ...formatOperationInfo(context)]
  if (format === 'json') {
    outputInfo(`${headline}\n${items.join('\n')}`)
    return
  }
  renderInfo({headline, body: [{list: {items}}]})
}
