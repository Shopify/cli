import {renderOperationResult} from './operation_result.js'
import {Shop} from '../apis/destinations/index.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {Token} from '@shopify/cli-kit/node/ui'

export function renderCopyResult(
  sourceShop: Shop,
  targetShop: Shop,
  copyOperation: BulkDataOperationByIdResponse,
): void {
  const msg: Token[] = [`Copy operation from`, {info: sourceShop.domain}, `to`, {info: targetShop.domain}]
  renderOperationResult(msg, copyOperation)
}
