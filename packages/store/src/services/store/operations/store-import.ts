import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {BulkDataStoreImportStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {Organization, Shop} from '../../../apis/destinations/index.js'
import {parseResourceConfigFlags} from '../../../lib/resource-config.js'
import {findStore} from '../utils/store-utils.js'
import {FileUploader} from '../utils/file-uploader.js'
import {MockFileUploader} from '../utils/mock-file-uploader.js'
import {ResultFileHandler} from '../utils/result-file-handler.js'
import {ApiClient} from '../api/api-client.js'
import {ApiClientInterface} from '../types/api-client.js'
import {BulkOperationTaskGenerator, BulkOperationContext} from '../utils/bulk-operation-task-generator.js'
import {renderCopyInfo} from '../../../prompts/copy_info.js'
import {renderImportResult} from '../../../prompts/import_result.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {Task, renderTasks, renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {fileExists} from '@shopify/cli-kit/node/fs'

export class StoreImportOperation implements StoreOperation {
  fromArg: string | undefined
  toArg: string | undefined
  private readonly apiClient: ApiClientInterface
  private fileUploader: FileUploader | MockFileUploader
  private readonly resultFileHandler: ResultFileHandler
  private readonly orgs: Organization[]
  private readonly bpSession: string

  constructor(bpSession: string, apiClient?: ApiClientInterface, orgs?: Organization[]) {
    this.apiClient = apiClient ?? new ApiClient()
    this.fileUploader = new FileUploader()
    this.resultFileHandler = new ResultFileHandler()
    this.orgs = orgs ?? []
    this.bpSession = bpSession
  }

  async execute(fromFile: string, toStore: string, flags: FlagOptions): Promise<void> {
    this.fromArg = fromFile
    this.toArg = toStore

    if (flags.mock) {
      this.fileUploader = new MockFileUploader()
    }

    await this.validateInputFile(fromFile)

    const targetShop = findStore(toStore, this.orgs)
    this.validateShop(targetShop)

    if (!flags['no-prompt']) {
      if (!(await this.confirmImportPrompt(fromFile, targetShop.domain))) {
        outputInfo('Exiting.')
        process.exit(0)
      }
    }

    renderCopyInfo('Import Operation', fromFile, targetShop.domain)

    const importOperation = await this.importDataWithProgress(
      targetShop.organizationId,
      targetShop,
      fromFile,
      this.bpSession,
      flags,
    )

    const status = importOperation.organization.bulkData.operation.status
    if (status === 'FAILED') {
      throw new Error(`Import failed`)
    }

    renderImportResult(targetShop, importOperation)
  }

  private async validateInputFile(filePath: string): Promise<void> {
    if (!(await fileExists(filePath))) {
      throw new Error(`File not found: ${filePath}`)
    }
  }

  private validateShop(targetShop: Shop | undefined): asserts targetShop is Shop {
    if (!targetShop) {
      throw new Error(`Target shop (${this.toArg}) not found.`)
    }
  }

  private async confirmImportPrompt(fromFile: string, targetDomain: string): Promise<boolean> {
    return renderConfirmationPrompt({
      message: `Import data from ${fromFile} to ${targetDomain}?`,
      confirmationMessage: 'Yes, import',
      cancellationMessage: 'Cancel',
    })
  }

  private async startImportOperation(
    bpSession: string,
    organizationId: string,
    targetShop: Shop,
    importUrl: string,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    const importResponse: BulkDataStoreImportStartResponse = await this.apiClient.startBulkDataStoreImport(
      organizationId,
      targetShop.domain,
      importUrl,
      parseResourceConfigFlags(flags.key as string[]),
      bpSession,
    )

    if (!importResponse.bulkDataStoreImportStart.success) {
      const errors = importResponse.bulkDataStoreImportStart.userErrors.map((error) => error.message).join(', ')
      throw new Error(`Failed to start import operation: ${errors}`)
    }

    const operationId = importResponse.bulkDataStoreImportStart.operation.id
    return this.apiClient.pollBulkDataOperation(organizationId, operationId, bpSession)
  }

  private async importDataWithProgress(
    organizationId: string,
    targetShop: Shop,
    filePath: string,
    bpSession: string,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    interface ImportContext extends BulkOperationContext {
      targetShop: Shop
      importUrl: string
      flags: FlagOptions
    }

    const taskGenerator = new BulkOperationTaskGenerator({
      operationName: 'import',
    })

    const bulkTasks = taskGenerator.generateTasks<ImportContext>({
      startOperation: async (ctx: ImportContext) => {
        return this.startImportOperation(ctx.bpSession, ctx.organizationId, ctx.targetShop, ctx.importUrl, ctx.flags)
      },
      pollOperation: async (ctx: ImportContext) => {
        const operationId = ctx.operation.organization.bulkData.operation.id
        return this.apiClient.pollBulkDataOperation(ctx.organizationId, operationId, ctx.bpSession)
      },
    })

    // Create all tasks including upload
    const allTasks: Task<ImportContext>[] = [
      {
        title: 'initializing',
        task: async (ctx: ImportContext) => {
          ctx.organizationId = organizationId
          ctx.bpSession = bpSession
          ctx.targetShop = targetShop
          ctx.flags = flags
          ctx.isComplete = false
        },
      },
      {
        title: `uploading SQLite file`,
        task: async (ctx: ImportContext) => {
          ctx.importUrl = await this.fileUploader.uploadSqliteFile(filePath, targetShop.domain)
        },
      },
      ...bulkTasks,
    ]

    const ctx: ImportContext = await renderTasks(allTasks)
    return ctx.operation
  }
}
