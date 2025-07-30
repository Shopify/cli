import {BaseStoreOperation} from './base-store-operation.js'
import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {BulkDataStoreImportStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {parseResourceConfigFlags} from '../../../lib/resource-config.js'
import {FileUploader} from '../utils/file-uploader.js'
import {MockFileUploader} from '../utils/mock-file-uploader.js'
import {ValidationError, ErrorCodes} from '../errors/errors.js'
import {ApiClientInterface} from '../types/api-client.js'
import {renderCopyInfo} from '../../../prompts/copy_info.js'
import {renderImportResult} from '../../../prompts/import_result.js'
import {confirmImportPrompt} from '../../../prompts/confirm_import.js'
import {renderImportProgress} from '../utils/bulk-operation-progress.js'
import {renderAsyncOperationStarted} from '../../../prompts/async_operation_started.js'
import {renderAsyncOperationJson} from '../../../prompts/async_operation_json.js'
import {clearLines} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {fileExists} from '@shopify/cli-kit/node/fs'

export class StoreImportOperation extends BaseStoreOperation implements StoreOperation {
  fromArg: string | undefined
  toArg: string | undefined
  private fileUploader: FileUploader | MockFileUploader

  constructor(bpSession: string, apiClient?: ApiClientInterface) {
    super(bpSession, apiClient)
    this.fileUploader = new FileUploader()
  }

  async execute(fromFile: string, toStore: string, flags: FlagOptions): Promise<void> {
    this.fromArg = fromFile
    this.toArg = toStore

    if (flags.mock) {
      this.fileUploader = new MockFileUploader()
    }

    await this.validateInputFile(fromFile)

    const {domain: targetShopDomain, id: apiShopId} = await this.normalizeAndValidateShop(toStore)

    if (!flags['no-prompt']) {
      if (!(await confirmImportPrompt(fromFile, targetShopDomain))) {
        outputInfo('Exiting.')
        return
      }
    }

    if (!flags.watch) {
      const importUrl = await this.fileUploader.uploadSqliteFile(fromFile, targetShopDomain)
      const importOperation = await this.startImportOperation(apiShopId, targetShopDomain, importUrl, flags)
      const operationId = importOperation.organization.bulkData.operation.id
      const organizationId = importOperation.organization.id
      if (!flags.json) {
        renderAsyncOperationStarted('Import', organizationId, fromFile, targetShopDomain, operationId)
        return
      }
      renderAsyncOperationJson('Import', importOperation, fromFile, targetShopDomain)
      return
    }

    renderCopyInfo('Import Operation', fromFile, targetShopDomain)

    outputInfo('Uploading SQLite file...')
    const importUrl = await this.fileUploader.uploadSqliteFile(fromFile, targetShopDomain)
    clearLines(1)

    const importOperation = await this.executeWithProgress(
      () => this.startImportOperation(apiShopId, targetShopDomain, importUrl, flags),
      apiShopId,
      'import',
      (_source, target) => `Starting import operation to ${target}...`,
      (status, completedCount) => {
        if (status === 'failed') return 'Import operation failed.'
        return `Import completed successfully! ${completedCount} items processed.`
      },
      this.renderProgress,
      fromFile,
      targetShopDomain,
    )

    renderImportResult(fromFile, targetShopDomain, importOperation)
  }

  protected getFailureErrorCode() {
    return ErrorCodes.IMPORT_FAILED
  }

  readonly renderProgress = (operation: BulkDataOperationByIdResponse, dotCount: number): string => {
    const storeOps = operation.organization.bulkData.operation.storeOperations
    const firstOp = storeOps?.[0]
    return renderImportProgress(firstOp?.completedObjectCount ?? 0, firstOp?.totalObjectCount ?? 0, dotCount)
  }

  private async validateInputFile(filePath: string): Promise<void> {
    if (!(await fileExists(filePath))) {
      throw new ValidationError(ErrorCodes.FILE_NOT_FOUND, {filePath})
    }
  }

  private async startImportOperation(
    apiShopId: string,
    targetShopDomain: string,
    importUrl: string,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    const importResponse: BulkDataStoreImportStartResponse = await this.apiClient.startBulkDataStoreImport(
      {type: 'shop', id: apiShopId},
      targetShopDomain,
      importUrl,
      parseResourceConfigFlags(flags.key as string[]),
      this.bpSession,
    )

    if (!importResponse.bulkDataStoreImportStart.success) {
      const errors = importResponse.bulkDataStoreImportStart.userErrors.map((error) => error.message)
      this.handleOperationError('import', errors)
    }

    const operationId = importResponse.bulkDataStoreImportStart.operation.id
    return this.apiClient.pollBulkDataOperation({type: 'shop', id: apiShopId}, operationId, this.bpSession)
  }
}
