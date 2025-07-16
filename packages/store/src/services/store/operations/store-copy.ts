import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {parseResourceConfigFlags} from '../../../lib/resource-config.js'
import {confirmCopyPrompt} from '../../../prompts/confirm_copy.js'
import {ApiClient} from '../api/api-client.js'
import {ApiClientInterface} from '../types/api-client.js'
import {BulkOperationTaskGenerator, BulkOperationContext} from '../utils/bulk-operation-task-generator.js'
import {ValidationError, OperationError, ErrorCodes} from '../errors/errors.js'
import {renderCopyInfo} from '../../../prompts/copy_info.js'
import {renderCopyResult} from '../../../prompts/copy_result.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {Task, renderTasks} from '@shopify/cli-kit/node/ui'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

export class StoreCopyOperation implements StoreOperation {
  fromArg: string | undefined
  toArg: string | undefined
  private readonly apiClient: ApiClientInterface
  private readonly bpSession: string

  constructor(bpSession: string, apiClient?: ApiClientInterface) {
    this.apiClient = apiClient ?? new ApiClient()
    this.bpSession = bpSession
  }

  async execute(fromStore: string, toStore: string, flags: FlagOptions): Promise<void> {
    this.fromArg = fromStore
    this.toArg = toStore

    const sourceShopDomain = await normalizeStoreFqdn(fromStore)
    const targetShopDomain = await normalizeStoreFqdn(toStore)

    const apiShopId = await this.validateShops(sourceShopDomain, targetShopDomain)

    if (!flags['no-prompt']) {
      if (!(await confirmCopyPrompt(sourceShopDomain, targetShopDomain))) {
        outputInfo('Exiting.')
        process.exit(0)
      }
    }

    renderCopyInfo('Copy Operation', sourceShopDomain, targetShopDomain)

    const copyOperation = await this.copyDataWithProgress(
      apiShopId,
      sourceShopDomain,
      targetShopDomain,
      this.bpSession,
      flags,
    )

    const status = copyOperation.organization.bulkData.operation.status
    if (status === 'FAILED') {
      throw new OperationError('copy', ErrorCodes.COPY_FAILED)
    }

    renderCopyResult(sourceShopDomain, targetShopDomain, copyOperation)
  }

  private async validateShops(sourceShopDomain: string, targetShopDomain: string): Promise<string> {
    const sourceShop = await this.apiClient.getStoreDetails(sourceShopDomain)
    const targetShop = await this.apiClient.getStoreDetails(targetShopDomain)

    if (sourceShop.id === targetShop.id) {
      throw new ValidationError(ErrorCodes.SAME_SHOP)
    }

    return sourceShop.id
  }

  private async startCopyOperation(
    bpSession: string,
    apiShopId: string,
    sourceShopDomain: string,
    targetShopDomain: string,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    const copyResponse: BulkDataStoreCopyStartResponse = await this.apiClient.startBulkDataStoreCopy(
      apiShopId,
      sourceShopDomain,
      targetShopDomain,
      parseResourceConfigFlags(flags.key as string[]),
      bpSession,
    )

    if (!copyResponse.bulkDataStoreCopyStart.success) {
      const errors = copyResponse.bulkDataStoreCopyStart.userErrors.map((error) => error.message).join(', ')
      throw new OperationError('copy', ErrorCodes.BULK_OPERATION_FAILED, {
        errors,
        operationType: 'copy',
      })
    }

    const operationId = copyResponse.bulkDataStoreCopyStart.operation.id
    return this.apiClient.pollBulkDataOperation(apiShopId, operationId, bpSession)
  }

  private async copyDataWithProgress(
    apiShopId: string,
    sourceShopDomain: string,
    targetShopDomain: string,
    bpSession: string,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    interface CopyContext extends BulkOperationContext {
      sourceShopDomain: string
      targetShopDomain: string
      flags: FlagOptions
    }

    const taskGenerator = new BulkOperationTaskGenerator({
      operationName: 'copy',
    })

    const tasks = taskGenerator.generateTasks<CopyContext>({
      startOperation: async (ctx: CopyContext) => {
        return this.startCopyOperation(
          ctx.bpSession,
          ctx.apiShopId,
          ctx.sourceShopDomain,
          ctx.targetShopDomain,
          ctx.flags,
        )
      },
      pollOperation: async (ctx: CopyContext) => {
        const operationId = ctx.operation.organization.bulkData.operation.id
        return this.apiClient.pollBulkDataOperation(ctx.apiShopId, operationId, ctx.bpSession)
      },
    })

    const allTasks: Task<CopyContext>[] = [
      {
        title: 'Initializing',
        task: async (ctx: CopyContext) => {
          ctx.apiShopId = apiShopId
          ctx.bpSession = bpSession
          ctx.sourceShopDomain = sourceShopDomain
          ctx.targetShopDomain = targetShopDomain
          ctx.flags = flags
          ctx.isComplete = false
        },
      },
      ...tasks,
    ]

    const ctx: CopyContext = await renderTasks(allTasks)
    return ctx.operation
  }
}
