import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {renderSuccess, renderWarning, InlineToken, Token, TokenItem} from '@shopify/cli-kit/node/ui'

export function renderOperationResult(
  baseMsg: Token[],
  operation: BulkDataOperationByIdResponse,
  targetShopDomain?: string,
): void {
  const storeOperations = operation.organization.bulkData.operation.storeOperations
  const hasErrors = storeOperations.some((op) => op.remoteOperationStatus === 'FAILED')
  const url = storeOperations[0]?.url
  const operationType = operation.organization.bulkData.operation.operationType

  const nextSteps: TokenItem<InlineToken>[] = []

  if (targetShopDomain && (operationType === 'STORE_COPY' || operationType === 'STORE_IMPORT')) {
    const targetStoreUrl = `https://${targetShopDomain}`
    nextSteps.push(['View', {link: {label: 'target shop', url: targetStoreUrl}}])
  }

  if (url) {
    nextSteps.push(['Download', {link: {label: 'result data', url}}])
  }

  if (hasErrors) {
    renderWarning({
      headline: 'Copy completed with errors.',
      body: baseMsg,
      nextSteps: nextSteps.length > 0 ? nextSteps : undefined,
    })
  } else {
    renderSuccess({
      headline: 'Copy completed.',
      body: baseMsg,
      nextSteps: nextSteps.length > 0 ? nextSteps : undefined,
    })
  }
}
