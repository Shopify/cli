import {renderOperationResult} from './operation_result.js'
import {Shop} from '../apis/destinations/index.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {Token} from '@shopify/cli-kit/node/ui'

export function renderCopyResult(
  sourceShop: Shop,
  targetShop: Shop,
  copyOperation: BulkDataOperationByIdResponse,
): void {
  const msg: Token[] = [{subdued: 'From:'}, sourceShop.domain, {subdued: '\nTo:  '}, targetShop.domain]
  renderOperationResult(msg, copyOperation, targetShop)
}
