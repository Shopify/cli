import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {BulkDataStoreImportStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {parseResourceConfigFlags} from '../../../lib/resource-config.js'
import {FileUploader} from '../utils/file-uploader.js'
import {MockFileUploader} from '../utils/mock-file-uploader.js'
import {ApiClient} from '../api/api-client.js'
import {ValidationError, OperationError, ErrorCodes} from '../errors/errors.js'
import {ApiClientInterface} from '../types/api-client.js'
import {renderCopyInfo} from '../../../prompts/copy_info.js'
import {renderImportResult} from '../../../prompts/import_result.js'
import {confirmImportPrompt} from '../../../prompts/confirm_import.js'
import {renderBulkOperationProgress} from '../utils/bulk-operation-progress.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

export class StoreImportOperation implements StoreOperation {
  fromArg: string | undefined
  toArg: string | undefined
  private readonly apiClient: ApiClientInterface
  private fileUploader: FileUploader | MockFileUploader
  private readonly bpSession: string

  constructor(bpSession: string, apiClient?: ApiClientInterface) {
    this.apiClient = apiClient ?? new ApiClient()
    this.fileUploader = new FileUploader()
    this.bpSession = bpSession
  }

  async execute(fromFile: string, toStore: string, flags: FlagOptions): Promise<void> {
    this.fromArg = fromFile
    this.toArg = toStore

    if (flags.mock) {
      this.fileUploader = new MockFileUploader()
    }

    await this.validateInputFile(fromFile)

    const targetShopDomain = await normalizeStoreFqdn(toStore)
    const apiShopId = await this.validateShop(targetShopDomain)

    if (!flags['no-prompt']) {
      if (!(await confirmImportPrompt(fromFile, targetShopDomain))) {
        outputInfo('Exiting.')
        process.exit(0)
      }
    }

    renderCopyInfo('Import Operation', fromFile, targetShopDomain)

    const importOperation = await this.importDataWithProgress(
      apiShopId,
      targetShopDomain,
      fromFile,
      this.bpSession,
      flags,
    )

    const status = importOperation.organization.bulkData.operation.status
    if (status === 'FAILED') {
      throw new OperationError('import', ErrorCodes.IMPORT_FAILED)
    }

    renderImportResult(fromFile, targetShopDomain, importOperation)
  }

  private async validateInputFile(filePath: string): Promise<void> {
    if (!(await fileExists(filePath))) {
      throw new ValidationError(ErrorCodes.FILE_NOT_FOUND, {filePath})
    }
  }

  private async validateShop(targetShopDomain: string): Promise<string> {
    const targetShop = await this.apiClient.getStoreDetails(targetShopDomain)
    return targetShop.id
  }

  private async startImportOperation(
    bpSession: string,
    apiShopId: string,
    targetShopDomain: string,
    importUrl: string,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    const importResponse: BulkDataStoreImportStartResponse = await this.apiClient.startBulkDataStoreImport(
      apiShopId,
      targetShopDomain,
      importUrl,
      parseResourceConfigFlags(flags.key as string[]),
      bpSession,
    )

    if (!importResponse.bulkDataStoreImportStart.success) {
      const errors = importResponse.bulkDataStoreImportStart.userErrors.map((error) => error.message).join(', ')
      throw new OperationError('import', ErrorCodes.BULK_OPERATION_FAILED, {
        errors,
        operationType: 'import',
      })
    }

    const operationId = importResponse.bulkDataStoreImportStart.operation.id
    return this.apiClient.pollBulkDataOperation(apiShopId, operationId, bpSession)
  }

  private async importDataWithProgress(
    apiShopId: string,
    targetShopDomain: string,
    filePath: string,
    bpSession: string,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    // First upload the file
    outputInfo('Uploading SQLite file...')
    const importUrl = await this.fileUploader.uploadSqliteFile(filePath, targetShopDomain)

    // Then start the import operation with progress display
    return renderBulkOperationProgress({
      type: 'import',
      storeName: targetShopDomain,
      callbacks: {
        startOperation: async () => {
          return this.startImportOperation(bpSession, apiShopId, targetShopDomain, importUrl, flags)
        },
        pollOperation: async (operationId: string) => {
          return this.apiClient.pollBulkDataOperation(apiShopId, operationId, bpSession)
        },
      },
    })
  }
}
