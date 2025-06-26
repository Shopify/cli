import {Shop, Organization} from '../../apis/destinations/types.js'
import {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse} from '../../apis/organizations/types.js'
import {BaseBDCommand} from '../../lib/base-command.js'
import {fetchOrgs} from '../../apis/destinations/index.js'
import {startBulkDataStoreCopy, pollBulkDataOperation} from '../../apis/organizations/index.js'
import {commonFlags, shopSelectionFlags, resourceConfigFlags} from '../../lib/flags.js'
import {parseResourceConfigFlags} from '../../lib/resource-config.js'
import {confirmCopyPrompt} from '../../prompts/confirm_copy.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSuccess, Task, renderTasks, renderWarning, Token} from '@shopify/cli-kit/node/ui'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {outputInfo} from '@shopify/cli-kit/node/output'

enum OperationMode {
  STORE_COPY = 'STORE_COPY',
  STORE_EXPORT = 'STORE_EXPORT',
  STORE_IMPORT = 'STORE_IMPORT',
}

export default class Copy extends BaseBDCommand {
  static summary = 'Copy, export, or import store data'
  static description = 'Copy data between stores, export store data to SQLite, or import data from SQLite to a store'
  static hidden = true
  static flags = {
    ...shopSelectionFlags,
    ...resourceConfigFlags,
    ...commonFlags,
    ...globalFlags,
  }

  async runCommand(): Promise<void> {
    this.flags = (await this.parse(Copy)).flags

    const from = this.flags.from as string
    const to = this.flags.to as string

    if (!from && !to) {
      throw new Error('You must specify at least one of --from or --to flags')
    }

    const operationMode = this.determineOperationMode(from, to)

    switch (operationMode) {
      case OperationMode.STORE_COPY:
        await this.handleStoreCopy(from, to)
        break
      case OperationMode.STORE_EXPORT:
        await this.handleStoreExport(from, to)
        break
      case OperationMode.STORE_IMPORT:
        await this.handleStoreImport(from, to)
        break
    }
  }

  private determineOperationMode(from: string, to: string | undefined): OperationMode {
    const isFromStore = from ? this.isStoreIdentifier(from) : false
    const isFromFile = from ? this.isFileIdentifier(from) : false
    const isToStore = to ? this.isStoreIdentifier(to) : false
    const isToFile = to ? this.isFileIdentifier(to) : false

    if (isFromStore && isToStore) {
      return OperationMode.STORE_COPY
    } else if (isFromStore && isToFile) {
      return OperationMode.STORE_EXPORT
    } else if (isFromFile && isToStore) {
      return OperationMode.STORE_IMPORT
    }

    throw new Error('Invalid combination of --from and --to flags')
  }

  private isStoreIdentifier(value: string): boolean {
    return value.endsWith('.myshopify.com')
  }

  private isFileIdentifier(value: string): boolean {
    return value.endsWith('.sqlite') || value === '<sqlite>'
  }

  private async handleStoreCopy(from: string, to: string): Promise<void> {
    const bpSession = await ensureAuthenticatedBusinessPlatform()

    const orgs = await this.fetchOrgs(bpSession)

    const {sourceShop, targetShop} = this.shopsFromFlags(from, to, orgs)

    if (!this.flags.skipConfirmation) {
      if (!(await confirmCopyPrompt(sourceShop.domain, targetShop.domain))) {
        this.handleExit()
      }
    }

    const copyOperation = await this.copyDataWithProgress(sourceShop.organizationId, sourceShop, targetShop, bpSession)

    const status = copyOperation.organization.bulkData.operation.status
    if (status === 'FAILED') {
      throw new Error(`Copy failed`)
    }

    this.renderCopyResult(sourceShop, targetShop, copyOperation)
  }

  private async handleStoreExport(from: string, to: string | undefined): Promise<void> {
    throw new Error('Store export functionality is not implemented yet')
  }

  private async handleStoreImport(from: string, to: string): Promise<void> {
    throw new Error('Store import functionality is not implemented yet')
  }

  private async fetchOrgs(bpSession: string): Promise<Organization[]> {
    return (await fetchOrgs(bpSession)).filter((org) => org.shops.length > 1)
  }

  private shopsFromFlags(from: string, to: string, orgs: Organization[]): {sourceShop: Shop; targetShop: Shop} {
    const allShops = orgs.flatMap((org) => org.shops)
    const sourceShop = allShops.find((shop) => shop.domain === from)
    const targetShop = allShops.find((shop) => shop.domain === to)

    if (!sourceShop) {
      throw new Error(`Source shop ${from} not found`)
    }
    if (!targetShop) {
      throw new Error(`Target shop ${to} not found`)
    }

    if (sourceShop.id === targetShop.id) {
      throw new Error('Source and target shops are the same')
    }
    if (sourceShop.organizationId !== targetShop.organizationId) {
      throw new Error('Source and target shops are not in the same organization')
    }

    return {sourceShop, targetShop}
  }

  private async startCopyOperation(
    bpSession: string,
    organizationId: string,
    sourceShop: Shop,
    targetShop: Shop,
  ): Promise<BulkDataOperationByIdResponse> {
    outputInfo(`Copying from ${sourceShop.domain} to ${targetShop.domain}`)

    const copyResponse: BulkDataStoreCopyStartResponse = await startBulkDataStoreCopy(
      organizationId,
      sourceShop.domain,
      targetShop.domain,
      parseResourceConfigFlags(this.flags.key as string[]),
      bpSession,
    )

    if (!copyResponse.bulkDataStoreCopyStart.success) {
      const errors = copyResponse.bulkDataStoreCopyStart.userErrors.map((error) => error.message).join(', ')
      throw new Error(`Failed to start copy operation: ${errors}`)
    }

    const operationId = copyResponse.bulkDataStoreCopyStart.operation.id
    return pollBulkDataOperation(organizationId, operationId, bpSession)
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
      currentOperation = await pollBulkDataOperation(organizationId, operationId, bpSession)
    }
  }

  private async executeCopyOperation(
    organizationId: string,
    sourceShop: Shop,
    targetShop: Shop,
    bpSession: string,
  ): Promise<BulkDataOperationByIdResponse> {
    const initialOperation = await this.startCopyOperation(bpSession, organizationId, sourceShop, targetShop)
    return this.waitForCopyCompletion(bpSession, organizationId, initialOperation)
  }

  private async copyDataWithProgress(
    organizationId: string,
    sourceShop: Shop,
    targetShop: Shop,
    bpSession: string,
  ): Promise<BulkDataOperationByIdResponse> {
    interface Context {
      copyOperation: BulkDataOperationByIdResponse
    }

    const tasks: Task<Context>[] = [
      {
        title: `Starting copy from ${sourceShop.domain} to ${targetShop.domain}`,
        task: async (ctx: Context) => {
          ctx.copyOperation = await this.executeCopyOperation(organizationId, sourceShop, targetShop, bpSession)
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
