import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {Shop} from '../apis/destinations/index.js'
import {renderSuccess, renderWarning, InlineToken, Token, TokenItem} from '@shopify/cli-kit/node/ui'

export function renderOperationResult(
  baseMsg: Token[],
  operation: BulkDataOperationByIdResponse,
  targetShop?: Shop,
): void {
  const storeOperations = operation.organization.bulkData.operation.storeOperations
  const hasErrors = storeOperations.some((op) => op.remoteOperationStatus === 'FAILED')
  const url = storeOperations[0]?.url
  const operationType = operation.organization.bulkData.operation.operationType

  const nextSteps: TokenItem<InlineToken>[] = []

  if (targetShop && (operationType === 'STORE_COPY' || operationType === 'STORE_IMPORT')) {
    const targetStoreUrl = `https://${targetShop.domain}`
    nextSteps.push(['View', {link: {label: 'target shop', url: targetStoreUrl}}])
  }

  if (url) {
    nextSteps.push(['Download', {link: {label: 'result data', url}}])
  }

  if (hasErrors) {
    renderWarning({
      headline: 'Copy completed with errors',
      body: baseMsg,
      nextSteps: nextSteps.length > 0 ? nextSteps : undefined,
    })
  } else {
    renderSuccess({
      headline: 'Copy completed',
      body: baseMsg,
      nextSteps: nextSteps.length > 0 ? nextSteps : undefined,
    })
  }
}
