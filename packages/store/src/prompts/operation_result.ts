import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {renderSuccess, renderWarning, Token} from '@shopify/cli-kit/node/ui'

export function renderOperationResult(baseMsg: Token[], operation: BulkDataOperationByIdResponse): void {
  const storeOperations = operation.organization.bulkData.operation.storeOperations
  const hasErrors = storeOperations.some((op) => op.remoteOperationStatus === 'FAILED')
  const url = storeOperations[0]?.url

  if (hasErrors) {
    baseMsg.push(`completed with`)
    baseMsg.push({error: `errors. `})
    if (url) {
      const link = {link: {label: 'Results file can be downloaded for more details', url}}
      baseMsg.push(link)
    }
    renderWarning({
      body: baseMsg,
    })
  } else {
    baseMsg.push('complete. ')
    if (url) {
      const link = {link: {label: 'Results file can be downloaded for more details', url}}
      baseMsg.push(link)
    }
    renderSuccess({
      body: baseMsg,
    })
  }
}
