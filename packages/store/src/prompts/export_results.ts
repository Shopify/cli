import {Shop} from '../apis/destinations/index.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {renderSuccess, renderWarning, Token} from '@shopify/cli-kit/node/ui'

export function renderExportResult(sourceShop: Shop, exportOperation: BulkDataOperationByIdResponse): void {
  const msg: Token[] = [`Export operation from`, {info: sourceShop.domain}]

  const storeOperations = exportOperation.organization.bulkData.operation.storeOperations
  const hasErrors = storeOperations.some((op) => op.remoteOperationStatus === 'FAILED')
  const url = storeOperations[0]?.url

  if (hasErrors) {
    msg.push(`completed with`)
    msg.push({error: `errors`})
    renderWarning({
      body: msg,
    })
  } else {
    msg.push('complete')
    if (url) {
      const link = {link: {label: 'export file available for download', url}}
      msg.push(link)
    }
    renderSuccess({
      body: msg,
    })
  }
}
