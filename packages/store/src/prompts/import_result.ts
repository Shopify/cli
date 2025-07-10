import {renderOperationResult} from './operation_result.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {Shop} from '../apis/destinations/index.js'
import {Token} from '@shopify/cli-kit/node/ui'

export function renderImportResult(
  filePath: string,
  targetShop: Shop,
  importOperation: BulkDataOperationByIdResponse,
): void {
  const msg: Token[] = [{subdued: 'From:'}, filePath, {subdued: '\nTo:  '}, targetShop.domain]
  renderOperationResult(msg, importOperation, targetShop)
}
