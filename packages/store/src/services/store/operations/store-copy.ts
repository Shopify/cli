import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {Organization, Shop} from '../../../apis/destinations/index.js'
import {parseResourceConfigFlags} from '../../../lib/resource-config.js'
import {confirmCopyPrompt} from '../../../prompts/confirm_copy.js'
import {findStore} from '../utils/store-utils.js'
import {ApiClient} from '../api/api-client.js'
import {ApiClientInterface} from '../types/api-client.js'
import {BulkOperationTaskGenerator, BulkOperationContext} from '../utils/bulk-operation-task-generator.js'
import {ValidationError, OperationError, ErrorCodes} from '../errors/errors.js'
import {renderCopyInfo} from '../../../prompts/copy_info.js'
import {renderCopyResult} from '../../../prompts/copy_result.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {Task, renderTasks} from '@shopify/cli-kit/node/ui'

export class StoreCopyOperation implements StoreOperation {
  fromArg: string | undefined
  toArg: string | undefined
  private readonly apiClient: ApiClientInterface
  private readonly orgs: Organization[]
  private readonly bpSession: string

  constructor(bpSession: string, apiClient?: ApiClientInterface, orgs?: Organization[]) {
    this.apiClient = apiClient ?? new ApiClient()
    this.orgs = orgs ?? []
    this.bpSession = bpSession
  }

  async execute(fromStore: string, toStore: string, flags: FlagOptions): Promise<void> {
    this.fromArg = fromStore
    this.toArg = toStore

    const sourceShop = findStore(fromStore, this.orgs)
    const targetShop = findStore(toStore, this.orgs)

    this.validateShops(sourceShop, targetShop)

    if (!sourceShop || !targetShop) {
      throw new ValidationError(ErrorCodes.SHOP_NOT_FOUND)
    }

    if (!flags['no-prompt']) {
      if (!(await confirmCopyPrompt(sourceShop.domain, targetShop.domain))) {
        outputInfo('Exiting.')
        process.exit(0)
      }
    }

    renderCopyInfo('Copy Operation', sourceShop.domain, targetShop.domain)

    const copyOperation = await this.copyDataWithProgress(sourceShop, targetShop, this.bpSession, flags)

    const status = copyOperation.organization.bulkData.operation.status
    if (status === 'FAILED') {
      throw new OperationError('copy', ErrorCodes.COPY_FAILED)
    }

    renderCopyResult(sourceShop, targetShop, copyOperation)
  }

  private validateShops(sourceShop: Shop | undefined, targetShop: Shop | undefined): void {
    if (!sourceShop) {
      throw new ValidationError(ErrorCodes.SHOP_NOT_FOUND, {shop: this.fromArg ?? 'source'})
    }
    if (!targetShop) {
      throw new ValidationError(ErrorCodes.SHOP_NOT_FOUND, {shop: this.toArg ?? 'target'})
    }
    if (sourceShop.id === targetShop.id) {
      throw new ValidationError(ErrorCodes.SAME_SHOP)
    }
    if (sourceShop.organizationId !== targetShop.organizationId) {
      throw new ValidationError(ErrorCodes.DIFFERENT_ORG)
    }
  }

  private async startCopyOperation(
    bpSession: string,
    apiShopId: string,
    sourceShop: Shop,
    targetShop: Shop,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    const copyResponse: BulkDataStoreCopyStartResponse = await this.apiClient.startBulkDataStoreCopy(
      apiShopId,
      sourceShop.domain,
      targetShop.domain,
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
    sourceShop: Shop,
    targetShop: Shop,
    bpSession: string,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    interface CopyContext extends BulkOperationContext {
      sourceShop: Shop
      targetShop: Shop
      flags: FlagOptions
    }

    const taskGenerator = new BulkOperationTaskGenerator({
      operationName: 'copy',
    })

    const tasks = taskGenerator.generateTasks<CopyContext>({
      startOperation: async (ctx: CopyContext) => {
        return this.startCopyOperation(ctx.bpSession, ctx.apiShopId, ctx.sourceShop, ctx.targetShop, ctx.flags)
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
          ctx.apiShopId = sourceShop.publicId
          ctx.bpSession = bpSession
          ctx.sourceShop = sourceShop
          ctx.targetShop = targetShop
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
