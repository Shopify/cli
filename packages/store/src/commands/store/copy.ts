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

export default class Copy extends BaseBDCommand {
  static summary = 'Copy data from one store to another'
  static description = 'Copy data from one store to another'
  static hidden = true
  static flags = {
    ...shopSelectionFlags,
    ...resourceConfigFlags,
    ...commonFlags,
    ...globalFlags,
  }

  async runCommand(): Promise<void> {
    this.flags = (await this.parse(Copy)).flags

    const bpSession = await ensureAuthenticatedBusinessPlatform()

    const orgs = await this.fetchOrgs(bpSession)

    const {sourceShop, targetShop} = this.shopsFromFlags(this.flags.from as string, this.flags.to as string, orgs)

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

  private async fetchOrgs(bpSession: string): Promise<Organization[]> {
    return (await fetchOrgs(bpSession)).filter((org) => org.shops.length > 1)
  }

  private shopsFromFlags(from: string, to: string, orgs: Organization[]): {sourceShop: Shop; targetShop: Shop} {
    if (!from || !to) {
      throw new Error('Both from and to flags must be provided')
    }

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
