import {BaseStoreOperation} from './base-store-operation.js'
import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {parseResourceConfigFlags} from '../../../lib/resource-config.js'
import {confirmCopyPrompt} from '../../../prompts/confirm_copy.js'
import {renderCopyInfo} from '../../../prompts/copy_info.js'
import {renderCopyResult} from '../../../prompts/copy_result.js'
import {renderExportProgress, renderImportProgress, isOperationComplete} from '../utils/bulk-operation-progress.js'
import {ValidationError, ErrorCodes} from '../errors/errors.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import colors from '@shopify/cli-kit/node/colors'

export class StoreCopyOperation extends BaseStoreOperation implements StoreOperation {
  fromArg: string | undefined
  toArg: string | undefined

  async execute(fromStore: string, toStore: string, flags: FlagOptions): Promise<void> {
    this.fromArg = fromStore
    this.toArg = toStore

    const {domain: sourceShopDomain, id: sourceShopId} = await this.normalizeAndValidateShop(fromStore)
    const {domain: targetShopDomain, id: targetShopId} = await this.normalizeAndValidateShop(toStore)

    await this.validateShopsNotSame(sourceShopId, targetShopId)

    if (!flags['no-prompt']) {
      if (!(await confirmCopyPrompt(sourceShopDomain, targetShopDomain))) {
        outputInfo('Exiting.')
        return
      }
    }

    renderCopyInfo('Copy operation', sourceShopDomain, targetShopDomain)

    const copyOperation = await this.executeWithProgress(
      () => this.startCopyOperation(sourceShopId, sourceShopDomain, targetShopDomain, flags),
      sourceShopId,
      'copy',
      (source, target) => `Starting copy operation from ${source} to ${target}...`,
      (status, _completedCount, source, target) => {
        if (status === 'failed') return 'Copy operation failed.'
        return `Copy completed successfully! Data copied from ${source} to ${target}.`
      },
      this.renderProgress,
      sourceShopDomain,
      targetShopDomain,
    )

    renderCopyResult(sourceShopDomain, targetShopDomain, copyOperation)
  }

  protected getFailureErrorCode() {
    return ErrorCodes.COPY_FAILED
  }

  private readonly renderProgress = (operation: BulkDataOperationByIdResponse, dotCount: number): string => {
    const storeOps = operation.organization.bulkData.operation.storeOperations
    if (!storeOps || storeOps.length === 0) {
      return ''
    }

    const [exportOp, importOp] = storeOps
    const isExportComplete = exportOp && isOperationComplete(exportOp)

    if (storeOps.length === 2 && isExportComplete) {
      const importContent = renderImportProgress(
        importOp?.completedObjectCount ?? 0,
        importOp?.totalObjectCount ?? 0,
        dotCount,
      )
      return `${colors.dim('Step 2 of 2')}\n\n${importContent}`
    }

    const exportContent = renderExportProgress(exportOp?.completedObjectCount ?? 0, dotCount)
    return `${colors.dim('Step 1 of 2')}\n\n${exportContent}`
  }

  private async startCopyOperation(
    apiShopId: string,
    sourceShopDomain: string,
    targetShopDomain: string,
    flags: FlagOptions,
  ): Promise<BulkDataOperationByIdResponse> {
    const copyResponse: BulkDataStoreCopyStartResponse = await this.apiClient.startBulkDataStoreCopy(
      apiShopId,
      sourceShopDomain,
      targetShopDomain,
      parseResourceConfigFlags(flags.key as string[]),
      this.bpSession,
    )

    if (!copyResponse.bulkDataStoreCopyStart.success) {
      const errors = copyResponse.bulkDataStoreCopyStart.userErrors.map((error) => error.message)
      this.handleOperationError('copy', errors)
    }

    const operationId = copyResponse.bulkDataStoreCopyStart.operation.id
    return this.apiClient.pollBulkDataOperation(apiShopId, operationId, this.bpSession)
  }

  private async validateShopsNotSame(sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) {
      throw new ValidationError(ErrorCodes.SAME_SHOP)
    }
  }
}
