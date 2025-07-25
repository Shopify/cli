import {renderOperationResult} from './operation_result.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {Token} from '@shopify/cli-kit/node/ui'

export function renderImportResult(
  filePath: string,
  targetShopDomain: string,
  importOperation: BulkDataOperationByIdResponse,
): void {
  const msg: Token[] = [{subdued: 'From:'}, filePath, {subdued: '\nTo:  '}, targetShopDomain]
  renderOperationResult(msg, importOperation, targetShopDomain)
}
