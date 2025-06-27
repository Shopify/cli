import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {Shop} from '../../../apis/destinations/types.js'
import {parseResourceConfigFlags} from '../../../lib/resource-config.js'
import {confirmCopyPrompt} from '../../../prompts/confirm_copy.js'
import {findShop} from '../utils/store-utils.js'
import {ApiClient} from '../api/api-client.js'
import {MockApiClient} from '../mock/mock-api-client.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderSuccess, Task, renderTasks, renderWarning, Token} from '@shopify/cli-kit/node/ui'

export class StoreCopyOperation implements StoreOperation {
  fromArg: string | undefined
  toArg: string | undefined
  private apiClient: ApiClient

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient ?? new ApiClient()
  }

  async execute(fromStore: string, toStore: string, flags: FlagOptions): Promise<void> {
    this.fromArg = fromStore
    this.toArg = toStore

    if (flags.mock) {
      this.apiClient = new MockApiClient()
    }

    const bpSession = await this.apiClient.ensureAuthenticatedBusinessPlatform()
    const orgs = await this.apiClient.fetchOrganizations(bpSession)

    const sourceShop = findShop(fromStore, orgs)
    const targetShop = findShop(toStore, orgs)

    this.validateShops(sourceShop, targetShop)

    if (!sourceShop || !targetShop) {
      throw new Error('Source or target shop not found.')
    }

    if (!flags.skipConfirmation) {
      if (!(await confirmCopyPrompt(sourceShop.domain, targetShop.domain))) {
        outputInfo('Exiting.')
        process.exit(0)
      }
    }

    outputInfo(`Copying data from ${sourceShop.domain} to ${targetShop.domain}\n\n`)
    const copyOperation = await this.copyDataWithProgress(
      sourceShop.organizationId,
      sourceShop,
      targetShop,
      bpSession,
      flags,
    )

    const status = copyOperation.organization.bulkData.operation.status
    if (status === 'FAILED') {
      throw new Error(`Copy failed`)
    }

    this.renderCopyResult(sourceShop, targetShop, copyOperation)
  }

  private validateShops(sourceShop: Shop | undefined, targetShop: Shop | undefined): void {
    if (!sourceShop) {
      throw new Error(`Source shop (${this.fromArg}) not found.`)
    }
    if (!targetShop) {
      throw new Error(`Target shop (${this.toArg}) not found.`)
    }

    if (sourceShop.id === targetShop.id) {
      throw new Error('Source and target shops must not be the same.')
    }
    if (sourceShop.organizationId !== targetShop.organizationId) {
      throw new Error('Source and target shops must be in the same organization.')
    }
  }

  private async startCopyOperation(
    bpSession: string,
    organizationId: string,
    sourceShop: Shop,
    targetShop: Shop,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    // outputInfo(`Copying from ${sourceShop.domain} to ${targetShop.domain}`)

    const copyResponse: BulkDataStoreCopyStartResponse = await this.apiClient.startBulkDataStoreCopy(
      organizationId,
      sourceShop.domain,
      targetShop.domain,
      parseResourceConfigFlags(flags.key as string[]),
      bpSession,
    )

    if (!copyResponse.bulkDataStoreCopyStart.success) {
      const errors = copyResponse.bulkDataStoreCopyStart.userErrors.map((error) => error.message).join(', ')
      throw new Error(`Failed to start copy operation: ${errors}`)
    }

    const operationId = copyResponse.bulkDataStoreCopyStart.operation.id
    return this.apiClient.pollBulkDataOperation(organizationId, operationId, bpSession)
  }

  private async waitForCopyCompletion(
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
        throw new Error(`Copy operation failed`)
      }

      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // eslint-disable-next-line no-await-in-loop
      currentOperation = await this.apiClient.pollBulkDataOperation(organizationId, operationId, bpSession)
    }
  }

  private async executeCopyOperation(
    organizationId: string,
    sourceShop: Shop,
    targetShop: Shop,
    bpSession: string,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    const initialOperation = await this.startCopyOperation(bpSession, organizationId, sourceShop, targetShop, flags)
    return this.waitForCopyCompletion(bpSession, organizationId, initialOperation)
  }

  private async copyDataWithProgress(
    organizationId: string,
    sourceShop: Shop,
    targetShop: Shop,
    bpSession: string,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    interface Context {
      copyOperation: BulkDataOperationByIdResponse
    }

    const tasks: Task<Context>[] = [
      {
        title: `Starting copy from ${sourceShop.domain} to ${targetShop.domain}`,
        task: async (ctx: Context) => {
          // Suppress console output during API calls to prevent interference with Ink
          const originalWrite = process.stdout.write
          const originalError = process.stderr.write

          try {
            // Temporarily redirect stdout/stderr to prevent interference
            // process.stdout.write = () => true
            // process.stderr.write = () => true

            ctx.copyOperation = await this.executeCopyOperation(
              organizationId,
              sourceShop,
              targetShop,
              bpSession,
              flags,
            )
          } finally {
            // Restore original write functions
            process.stdout.write = originalWrite
            // process.stderr.write = originalError
          }
        },
      },
    ]
    const ctx: Context = await renderTasks(tasks)
    return ctx.copyOperation
  }

  private renderCopyResult(sourceShop: Shop, targetShop: Shop, copyOperation: BulkDataOperationByIdResponse): void {
    const msg: Token[] = [`Copy operation from`, {info: sourceShop.domain}, `to`, {info: targetShop.domain}]

    const storeOperations = copyOperation.organization.bulkData.operation.storeOperations
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
