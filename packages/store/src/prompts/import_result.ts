import {renderOperationResult} from './operation_result.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {Shop} from '../apis/destinations/index.js'
import {Token} from '@shopify/cli-kit/node/ui'

export function renderImportResult(targetShop: Shop, importOperation: BulkDataOperationByIdResponse): void {
  const msg: Token[] = [`Import operation to`, {info: targetShop.domain}]
  renderOperationResult(msg, importOperation)
}
