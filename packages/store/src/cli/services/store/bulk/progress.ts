import {formatOperationInfo} from './common.js'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export function logBulkOperationStart(
  headline: string,
  context: {storeFqdn: string; version?: string; operationId?: string},
): void {
  const items = [...(context.operationId ? [`ID: ${context.operationId}`] : []), ...formatOperationInfo(context)]
  renderInfo({headline, body: [{list: {items}}]})
}
