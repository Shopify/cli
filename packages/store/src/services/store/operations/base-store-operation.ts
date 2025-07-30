import {BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {ApiClient} from '../api/api-client.js'
import {ApiClientInterface} from '../types/api-client.js'
import {OperationError, ErrorCodes} from '../errors/errors.js'
import {renderProgressWithPolling} from '../utils/bulk-operation-progress.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

export abstract class BaseStoreOperation {
  protected readonly apiClient: ApiClientInterface
  protected readonly bpSession: string

  constructor(bpSession: string, apiClient?: ApiClientInterface) {
    this.apiClient = apiClient ?? new ApiClient()
    this.bpSession = bpSession
  }

  protected async normalizeAndValidateShop(shopDomain: string): Promise<{domain: string; id: string}> {
    const normalizedDomain = await normalizeStoreFqdn(shopDomain)
    const shopDetails = await this.apiClient.getStoreDetails(normalizedDomain)
    return {domain: normalizedDomain, id: shopDetails.id}
  }

  protected async executeWithProgress(
    startOperation: () => Promise<BulkDataOperationByIdResponse>,
    shopId: string,
    operationType: string,
    initialMessage: (source: string, target?: string) => string,
    completionMessage: (
      status: 'completed' | 'failed',
      completedCount: number,
      source: string,
      target?: string,
    ) => string,
    renderProgress: (operation: BulkDataOperationByIdResponse, animationIteration: number) => string,
    source: string,
    target?: string,
  ): Promise<BulkDataOperationByIdResponse> {
    const operation = await renderProgressWithPolling(
      startOperation,
      (operationId: string) =>
        this.apiClient.pollBulkDataOperation({type: 'shop', id: shopId}, operationId, this.bpSession),
      renderProgress,
      () => initialMessage(source, target),
      (status, completedCount) => completionMessage(status, completedCount, source, target),
    )

    if (operation.organization.bulkData.operation.status === 'FAILED') {
      throw new OperationError(operationType, this.getFailureErrorCode())
    }

    return operation
  }

  protected handleOperationError(operationType: string, errors: string[]): never {
    const joinedErrors = errors.join(', ')
    throw new OperationError(operationType, ErrorCodes.BULK_OPERATION_FAILED, {
      errors: joinedErrors,
      operationType,
    })
  }

  protected abstract getFailureErrorCode(): (typeof ErrorCodes)[keyof typeof ErrorCodes]
}
