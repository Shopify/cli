import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {BulkDataStoreImportStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {Shop} from '../../../apis/destinations/types.js'
import {parseResourceConfigFlags} from '../../../lib/resource-config.js'
import {findShop} from '../utils/store-utils.js'
import {FileUploader} from '../utils/file-uploader.js'
import {MockFileUploader} from '../utils/mock-file-uploader.js'
import {ResultFileHandler} from '../utils/result-file-handler.js'
import {ApiClient} from '../api/api-client.js'
import {MockApiClient} from '../mock/mock-api-client.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderSuccess, Task, renderTasks, renderWarning, Token, renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {fileExists} from '@shopify/cli-kit/node/fs'

export class StoreImportOperation implements StoreOperation {
  fromArg: string | undefined
  toArg: string | undefined
  private apiClient: ApiClient
  private fileUploader: FileUploader | MockFileUploader
  private resultFileHandler: ResultFileHandler

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient || new ApiClient()
    this.fileUploader = new FileUploader()
    this.resultFileHandler = new ResultFileHandler()
  }

  async execute(fromFile: string, toStore: string, flags: FlagOptions): Promise<void> {
    this.fromArg = fromFile
    this.toArg = toStore

    if (flags.mock) {
      this.apiClient = new MockApiClient()
      this.fileUploader = new MockFileUploader()
    }

    await this.validateInputFile(fromFile)

    const bpSession = await this.apiClient.ensureAuthenticatedBusinessPlatform()
    const orgs = await this.apiClient.fetchOrganizations(bpSession)

    const targetShop = findShop(toStore, orgs)
    this.validateShop(targetShop)

    if (!flags.skipConfirmation) {
      if (!(await this.confirmImportPrompt(fromFile, targetShop.domain))) {
        outputInfo('Exiting.')
        process.exit(0)
      }
    }

    const importOperation = await this.importDataWithProgress(
      targetShop.organizationId,
      targetShop,
      fromFile,
      bpSession,
      flags,
    )

    const status = importOperation.organization.bulkData.operation.status
    if (status === 'FAILED') {
      throw new Error(`Import failed`)
    }

    this.renderImportResult(targetShop, importOperation)

    if (status === 'COMPLETED') {
      await this.resultFileHandler.promptAndHandleResultFile(importOperation, 'import', targetShop.domain)
    }
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
    outputInfo(`Importing data to ${targetShop.domain}`)

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

  private async waitForImportCompletion(
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
        throw new Error(`Import operation failed`)
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
      currentOperation = await this.apiClient.pollBulkDataOperation(organizationId, operationId, bpSession)
    }
  }

  private async executeImportOperation(
    organizationId: string,
    targetShop: Shop,
    importUrl: string,
    bpSession: string,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    const initialOperation = await this.startImportOperation(bpSession, organizationId, targetShop, importUrl, flags)
    return this.waitForImportCompletion(bpSession, organizationId, initialOperation)
  }

  private async importDataWithProgress(
    organizationId: string,
    targetShop: Shop,
    filePath: string,
    bpSession: string,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    interface Context {
      importUrl: string
      importOperation: BulkDataOperationByIdResponse
    }

    const tasks: Task<Context>[] = [
      {
        title: `Uploading SQLite file`,
        task: async (ctx: Context) => {
          ctx.importUrl = await this.fileUploader.uploadSqliteFile(filePath, targetShop.domain)
        },
      },
      {
        title: `Starting import to ${targetShop.domain}`,
        task: async (ctx: Context) => {
          ctx.importOperation = await this.executeImportOperation(organizationId, targetShop, ctx.importUrl, bpSession, flags)
        },
      },
    ]

    const ctx: Context = await renderTasks(tasks)
    return ctx.importOperation
  }

  private renderImportResult(targetShop: Shop, importOperation: BulkDataOperationByIdResponse): void {
    const msg: Token[] = [`Import operation to`, {info: targetShop.domain}]

    const storeOperations = importOperation.organization.bulkData.operation.storeOperations
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
