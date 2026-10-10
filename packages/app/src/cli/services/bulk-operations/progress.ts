import {formatOperationInfo} from '../graphql/common.js'
import {Organization, OrganizationApp} from '../../models/organization.js'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'

export function logBulkOperationStart(
  headline: string,
  context: {
    organization: Organization
    remoteApp: OrganizationApp
    storeFqdn: string
    version?: string
    operationId?: string
  },
  format: 'text' | 'json',
): void {
  const items = [...(context.operationId ? [`ID: ${context.operationId}`] : []), ...formatOperationInfo(context)]
  if (format === 'json') {
    outputInfo(`${headline}\n${items.join('\n')}`)
    return
  }
  renderInfo({headline, body: [{list: {items}}]})
}
