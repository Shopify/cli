import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {BulkDataStoreExportStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {Organization} from '../../../apis/destinations/index.js'
import {ResultFileHandler} from '../utils/result-file-handler.js'
import {ApiClient} from '../api/api-client.js'
import {ApiClientInterface} from '../types/api-client.js'
import {renderCopyInfo} from '../../../prompts/copy_info.js'
import {OperationError, ErrorCodes} from '../errors/errors.js'
import {renderExportResult} from '../../../prompts/export_results.js'
import {confirmExportPrompt} from '../../../prompts/confirm_export.js'
import {renderBulkOperationProgress} from '../utils/bulk-operation-progress.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

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

    const sourceShopDomain = await normalizeStoreFqdn(fromStore)

    const apiShopId = await this.validateShop(sourceShopDomain)

    if (!flags['no-prompt']) {
      const fileExists = fileExistsSync(toFile)
      if (!(await confirmExportPrompt(sourceShopDomain, toFile, fileExists))) {
        outputInfo('Exiting.')
        process.exit(0)
      }
    }

    renderCopyInfo('Export Operation', sourceShopDomain, toFile)
    const exportOperation = await this.exportDataWithProgress(apiShopId, sourceShopDomain, this.bpSession)

    const status = exportOperation.organization.bulkData.operation.status
    if (status === 'FAILED') {
      throw new OperationError('export', ErrorCodes.EXPORT_FAILED)
    }

    renderExportResult(sourceShopDomain, exportOperation)

    if (status === 'COMPLETED') {
      await this.resultFileHandler.promptAndHandleResultFile(exportOperation, 'export', flags, toFile)
    }
  }

  private async validateShop(sourceShopDomain: string): Promise<string> {
    const sourceShop = await this.apiClient.getStoreDetails(sourceShopDomain)
    return sourceShop.id
  }

  private async startExportOperation(
    bpSession: string,
    apiShopId: string,
    sourceShopDomain: string,
  ): Promise<BulkDataOperationByIdResponse> {
    const exportResponse: BulkDataStoreExportStartResponse = await this.apiClient.startBulkDataStoreExport(
      apiShopId,
      sourceShopDomain,
      bpSession,
    )

    if (!exportResponse.bulkDataStoreExportStart.success) {
      const errors = exportResponse.bulkDataStoreExportStart.userErrors.map((error) => error.message).join(', ')
      throw new OperationError('export', ErrorCodes.BULK_OPERATION_FAILED, {
        errors,
        operationType: 'export',
      })
    }

    const operationId = exportResponse.bulkDataStoreExportStart.operation.id
    return this.apiClient.pollBulkDataOperation(apiShopId, operationId, bpSession)
  }

  private async exportDataWithProgress(
    apiShopId: string,
    sourceShopDomain: string,
    bpSession: string,
  ): Promise<BulkDataOperationByIdResponse> {
    return renderBulkOperationProgress({
      type: 'export',
      storeName: sourceShopDomain,
      callbacks: {
        startOperation: async () => {
          return this.startExportOperation(bpSession, apiShopId, sourceShopDomain)
        },
        pollOperation: async (operationId: string) => {
          return this.apiClient.pollBulkDataOperation(apiShopId, operationId, bpSession)
        },
      },
    })
  }
}
