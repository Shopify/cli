import {renderOperationResult} from './operation_result.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {Token} from '@shopify/cli-kit/node/ui'

export function renderCopyResult(
  sourceShopDomain: string,
  targetShopDomain: string,
  copyOperation: BulkDataOperationByIdResponse,
): void {
  const msg: Token[] = [{subdued: 'From:'}, sourceShopDomain, {subdued: '\nTo:  '}, targetShopDomain]
  renderOperationResult(msg, copyOperation, targetShopDomain)
}
