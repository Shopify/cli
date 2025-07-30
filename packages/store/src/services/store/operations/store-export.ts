import {BaseStoreOperation} from './base-store-operation.js'
import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {BulkDataStoreExportStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {ResultFileHandler} from '../utils/result-file-handler.js'
import {ApiClientInterface} from '../types/api-client.js'
import {renderCopyInfo} from '../../../prompts/copy_info.js'
import {renderExportResult} from '../../../prompts/export_results.js'
import {confirmExportPrompt} from '../../../prompts/confirm_export.js'
import {renderExportProgress} from '../utils/bulk-operation-progress.js'
import {ErrorCodes} from '../errors/errors.js'
import {renderAsyncOperationStarted} from '../../../prompts/async_operation_started.js'
import {renderAsyncOperationJson} from '../../../prompts/async_operation_json.js'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {outputInfo} from '@shopify/cli-kit/node/output'

export class StoreExportOperation extends BaseStoreOperation implements StoreOperation {
  fromArg: string | undefined
  private readonly resultFileHandler: ResultFileHandler

  constructor(bpSession: string, apiClient?: ApiClientInterface) {
    super(bpSession, apiClient)
    this.resultFileHandler = new ResultFileHandler()
  }

  async execute(fromStore: string, toFile: string, flags: FlagOptions): Promise<void> {
    this.fromArg = fromStore

    const {domain: sourceShopDomain, id: apiShopId} = await this.normalizeAndValidateShop(fromStore)

    if (!flags['no-prompt']) {
      const fileExists = fileExistsSync(toFile)
      if (!(await confirmExportPrompt(sourceShopDomain, toFile, fileExists))) {
        outputInfo('Exiting.')
        return
      }
    }
    if (!flags.watch) {
      const exportOperation = await this.startExportOperation(apiShopId, sourceShopDomain)
      const operationId = exportOperation.organization.bulkData.operation.id
      const organizationId = exportOperation.organization.id
      if (!flags.json) {
        renderAsyncOperationStarted('Export', organizationId, sourceShopDomain, toFile, operationId)
        return
      }
      renderAsyncOperationJson('Export', exportOperation, toFile, sourceShopDomain)
      return
    }
    renderCopyInfo('Export Operation', sourceShopDomain, toFile)

    const exportOperation = await this.executeWithProgress(
      () => this.startExportOperation(apiShopId, sourceShopDomain),
      apiShopId,
      'export',
      (source) => `Starting export operation from ${source}...`,
      (status, completedCount) => {
        if (status === 'failed') return 'Export operation failed.'
        return `Export completed successfully! ${completedCount} items processed.`
      },
      this.renderProgress,
      sourceShopDomain,
    )

    renderExportResult(sourceShopDomain, exportOperation)

    if (exportOperation.organization.bulkData.operation.status === 'COMPLETED') {
      await this.resultFileHandler.promptAndHandleResultFile(exportOperation, 'export', flags, toFile)
    }
  }

  protected getFailureErrorCode() {
    return ErrorCodes.EXPORT_FAILED
  }

  readonly renderProgress = (operation: BulkDataOperationByIdResponse, dotCount: number): string => {
    const storeOps = operation.organization.bulkData.operation.storeOperations
    const exportCount = storeOps?.[0]?.completedObjectCount ?? 0
    return renderExportProgress(exportCount, dotCount)
  }

  private async startExportOperation(
    apiShopId: string,
    sourceShopDomain: string,
  ): Promise<BulkDataOperationByIdResponse> {
    const exportResponse: BulkDataStoreExportStartResponse = await this.apiClient.startBulkDataStoreExport(
      {type: 'shop', id: apiShopId},
      sourceShopDomain,
      this.bpSession,
    )

    if (!exportResponse.bulkDataStoreExportStart.success) {
      const errors = exportResponse.bulkDataStoreExportStart.userErrors.map((error) => error.message)
      this.handleOperationError('export', errors)
    }

    const operationId = exportResponse.bulkDataStoreExportStart.operation.id
    return this.apiClient.pollBulkDataOperation({type: 'shop', id: apiShopId}, operationId, this.bpSession)
  }
}
