import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {BulkDataStoreExportStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {Shop} from '../../../apis/destinations/types.js'
import {findShop} from '../utils/store-utils.js'
import {ResultFileHandler} from '../utils/result-file-handler.js'
import {ApiClient} from '../api/api-client.js'
import {MockApiClient} from '../mock/mock-api-client.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderSuccess, Task, renderTasks, renderWarning, Token} from '@shopify/cli-kit/node/ui'

export class StoreExportOperation implements StoreOperation {
  fromArg: string | undefined
  private apiClient: ApiClient
  private readonly resultFileHandler: ResultFileHandler

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient ?? new ApiClient()
    this.resultFileHandler = new ResultFileHandler()
  }

  async execute(fromStore: string, _toFile: string, flags: FlagOptions): Promise<void> {
    this.fromArg = fromStore

    if (flags.mock) {
      this.apiClient = new MockApiClient()
    }

    const bpSession = await this.apiClient.ensureAuthenticatedBusinessPlatform()
    const orgs = await this.apiClient.fetchOrganizations(bpSession)

    const sourceShop = findShop(fromStore, orgs)
    this.validateShop(sourceShop)

    const exportOperation = await this.exportDataWithProgress(sourceShop.organizationId, sourceShop, bpSession)

    const status = exportOperation.organization.bulkData.operation.status
    if (status === 'FAILED') {
      throw new Error(`Export failed`)
    }

    this.renderExportResult(sourceShop, exportOperation)

    if (status === 'COMPLETED') {
      await this.resultFileHandler.promptAndHandleResultFile(exportOperation, 'export', sourceShop.domain)
    }
  }

  private validateShop(sourceShop: Shop | undefined): asserts sourceShop is Shop {
    if (!sourceShop) {
      throw new Error(`Source shop (${this.fromArg}) not found.`)
    }
  }

  private async startExportOperation(
    bpSession: string,
    organizationId: string,
    sourceShop: Shop,
  ): Promise<BulkDataOperationByIdResponse> {
    outputInfo(`Exporting data from ${sourceShop.domain}`)

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

  private async waitForExportCompletion(
    bpSession: string,
    organizationId: string,
    initialOperation: BulkDataOperationByIdResponse,
  ): Promise<BulkDataOperationByIdResponse> {
    let currentOperation = initialOperation
    const operationId = currentOperation.organization.bulkData.operation.id

    while (true) {
      const status = currentOperation.organization.bulkData.operation.status

      if (status === 'COMPLETED') {
        return currentOperation
      } else if (status === 'FAILED') {
        throw new Error(`Export operation failed`)
      }

      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // eslint-disable-next-line no-await-in-loop
      currentOperation = await this.apiClient.pollBulkDataOperation(organizationId, operationId, bpSession)
    }
  }

  private async executeExportOperation(
    organizationId: string,
    sourceShop: Shop,
    bpSession: string,
  ): Promise<BulkDataOperationByIdResponse> {
    const initialOperation = await this.startExportOperation(bpSession, organizationId, sourceShop)
    return this.waitForExportCompletion(bpSession, organizationId, initialOperation)
  }

  private async exportDataWithProgress(
    organizationId: string,
    sourceShop: Shop,
    bpSession: string,
  ): Promise<BulkDataOperationByIdResponse> {
    interface Context {
      exportOperation: BulkDataOperationByIdResponse
    }

    const tasks: Task<Context>[] = [
      {
        title: `Starting export from ${sourceShop.domain}`,
        task: async (ctx: Context) => {
          ctx.exportOperation = await this.executeExportOperation(organizationId, sourceShop, bpSession)
        },
      },
    ]

    const ctx: Context = await renderTasks(tasks)
    return ctx.exportOperation
  }

  private renderExportResult(sourceShop: Shop, exportOperation: BulkDataOperationByIdResponse): void {
    const msg: Token[] = [`Export operation from`, {info: sourceShop.domain}]

    const storeOperations = exportOperation.organization.bulkData.operation.storeOperations
    const hasErrors = storeOperations.some((op) => op.remoteOperationStatus === 'FAILED')

    if (hasErrors) {
      msg.push(`completed with`)
      msg.push({error: `errors`})
      renderWarning({
        body: msg,
      })
    } else {
      msg.push('complete')
      renderSuccess({
        body: msg,
      })
    }
  }
}
