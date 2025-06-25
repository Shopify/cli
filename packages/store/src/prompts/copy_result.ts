import {Shop} from '../apis/destinations/index.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {Token, renderWarning, renderSuccess} from '@shopify/cli-kit/node/ui'

export function renderCopyResult(
  sourceShop: Shop,
  targetShop: Shop,
  copyOperation: BulkDataOperationByIdResponse,
): void {
  const msg: Token[] = [`Copy operation from`, {info: sourceShop.domain}, `to`, {info: targetShop.domain}]

  const storeOperations = copyOperation.organization.bulkData.operation.storeOperations
  const hasErrors = storeOperations.some((op) => op.remoteOperationStatus === 'FAILED')

  if (hasErrors) {
    msg.push(`completed with`)
    msg.push({error: `errors`})
    renderWarning({
      body: msg,
    })
  } else {
    msg.push('complete')
    renderSuccess({
      body: msg,
    })
  }
}
