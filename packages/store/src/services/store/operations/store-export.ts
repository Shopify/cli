import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {BulkDataStoreExportStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {Organization, Shop} from '../../../apis/destinations/index.js'
import {findStore} from '../utils/store-utils.js'
import {ResultFileHandler} from '../utils/result-file-handler.js'
import {ApiClient} from '../api/api-client.js'
import {ApiClientInterface} from '../types/api-client.js'
import {BulkOperationTaskGenerator, BulkOperationContext} from '../utils/bulk-operation-task-generator.js'
import {renderCopyInfo} from '../../../prompts/copy_info.js'
import {renderExportResult} from '../../../prompts/export_results.js'
import {Task, renderTasks} from '@shopify/cli-kit/node/ui'

export class StoreExportOperation implements StoreOperation {
  fromArg: string | undefined
  private readonly apiClient: ApiClientInterface
  private readonly resultFileHandler: ResultFileHandler
  private readonly orgs: Organization[]
  private readonly bpSession: string

  constructor(bpSession: string, apiClient?: ApiClientInterface, orgs?: Organization[]) {
    this.apiClient = apiClient ?? new ApiClient()
    this.resultFileHandler = new ResultFileHandler()
    this.orgs = orgs ?? []
    this.bpSession = bpSession
  }

  async execute(fromStore: string, toFile: string, flags: FlagOptions): Promise<void> {
    this.fromArg = fromStore

    const sourceShop = findStore(fromStore, this.orgs)
    this.validateShop(sourceShop)

    renderCopyInfo('Export Operation', sourceShop.domain, toFile)
    const exportOperation = await this.exportDataWithProgress(sourceShop.organizationId, sourceShop, this.bpSession)

    const status = exportOperation.organization.bulkData.operation.status
    if (status === 'FAILED') {
      throw new Error(`Export failed`)
    }

    renderExportResult(sourceShop, exportOperation)

    if (status === 'COMPLETED') {
      await this.resultFileHandler.promptAndHandleResultFile(exportOperation, 'export', flags, toFile)
    }
  }

  private validateShop(sourceShop: Shop | undefined): asserts sourceShop is Shop {
    if (!sourceShop) {
      const message = `Source shop (${this.fromArg}) not found in any of the Early Access enabled organizations you have access to.`
      throw new Error(message)
    }
  }

  private async startExportOperation(
    bpSession: string,
    organizationId: string,
    sourceShop: Shop,
  ): Promise<BulkDataOperationByIdResponse> {
    const exportResponse: BulkDataStoreExportStartResponse = await this.apiClient.startBulkDataStoreExport(
      organizationId,
      sourceShop.domain,
      bpSession,
    )

    if (!exportResponse.bulkDataStoreExportStart.success) {
      const errors = exportResponse.bulkDataStoreExportStart.userErrors.map((error) => error.message).join(', ')
      throw new Error(`Failed to start export operation: ${errors}`)
    }

    const operationId = exportResponse.bulkDataStoreExportStart.operation.id
    return this.apiClient.pollBulkDataOperation(organizationId, operationId, bpSession)
  }

  private async exportDataWithProgress(
    organizationId: string,
    sourceShop: Shop,
    bpSession: string,
  ): Promise<BulkDataOperationByIdResponse> {
    interface ExportContext extends BulkOperationContext {
      sourceShop: Shop
    }

    const taskGenerator = new BulkOperationTaskGenerator({
      operationName: 'export',
    })

    const tasks = taskGenerator.generateTasks<ExportContext>({
      startOperation: async (ctx: ExportContext) => {
        return this.startExportOperation(ctx.bpSession, ctx.organizationId, ctx.sourceShop)
      },
      pollOperation: async (ctx: ExportContext) => {
        const operationId = ctx.operation.organization.bulkData.operation.id
        return this.apiClient.pollBulkDataOperation(ctx.organizationId, operationId, ctx.bpSession)
      },
    })

    // Add initial context setup task
    const allTasks: Task<ExportContext>[] = [
      {
        title: 'initializing',
        task: async (ctx: ExportContext) => {
          ctx.organizationId = organizationId
          ctx.bpSession = bpSession
          ctx.sourceShop = sourceShop
          ctx.isComplete = false
        },
      },
      ...tasks,
    ]

    const ctx: ExportContext = await renderTasks(allTasks)
    return ctx.operation
  }
}
