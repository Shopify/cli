import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {Shop} from '../apis/destinations/index.js'
import {renderSuccess, renderWarning, Token} from '@shopify/cli-kit/node/ui'

export function renderImportResult(targetShop: Shop, importOperation: BulkDataOperationByIdResponse): void {
  const msg: Token[] = [`Import operation to`, {info: targetShop.domain}]

  const storeOperations = importOperation.organization.bulkData.operation.storeOperations
  const hasErrors = storeOperations.some((op) => op.remoteOperationStatus === 'FAILED')
  const url = storeOperations[0]?.url

  if (hasErrors) {
    msg.push(`completed with`)
    msg.push({error: `errors`})
    if (url) {
      const link = {link: {label: 'results file can be downloaded for more details', url}}
      msg.push(link)
    }
    renderWarning({
      body: msg,
    })
  } else {
    msg.push('complete')
    if (url) {
      const link = {link: {label: 'results file can be downloaded for more details', url}}
      msg.push(link)
    }
    renderSuccess({
      body: msg,
    })
  }
}
