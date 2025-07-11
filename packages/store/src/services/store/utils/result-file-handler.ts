import {BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {FlagOptions} from '../../../lib/types.js'
import {OperationError, ErrorCodes} from '../errors/errors.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderConfirmationPrompt, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {fetch} from '@shopify/cli-kit/node/http'
import {createFileWriteStream} from '@shopify/cli-kit/node/fs'
import {pipeline} from 'node:stream/promises'
import * as zlib from 'node:zlib'

export class ResultFileHandler {
  async promptAndHandleResultFile(
    operation: BulkDataOperationByIdResponse,
    operationType: 'export' | 'import',
    flags: FlagOptions,
    customFilePath: string,
  ): Promise<void> {
    const storeOperations = operation.organization.bulkData.operation.storeOperations
    const downloadUrl = storeOperations.find((op) => op.url)?.url

    if (!downloadUrl) {
      outputInfo(`${operationType} completed, but no result file available.`)
      return
    }

    const shouldDownload =
      flags['no-prompt'] ||
      (await renderConfirmationPrompt({
        message: `Press Enter to download the ${operationType} result file.`,
        confirmationMessage: 'Download',
        cancellationMessage: 'Skip',
      }))

    if (shouldDownload) {
      await this.downloadAndProcessResultFile(downloadUrl, operationType, customFilePath)
    }
  }

  private async downloadAndProcessResultFile(url: string, operationType: string, filePath: string): Promise<void> {
    const isCompressed = url.includes('.gz')

    const tasks = [
      {
        title: `downloading and processing ${operationType} result file`,
        task: async () => {
          const response = await fetch(url)
          if (!response.body) {
            throw new OperationError('download', ErrorCodes.FILE_DOWNLOAD_FAILED)
          }

          const writeStream = createFileWriteStream(filePath)

          if (isCompressed) {
            const gunzip = zlib.createGunzip()
            await pipeline(response.body, gunzip, writeStream)
          } else {
            await pipeline(response.body, writeStream)
          }
        },
      },
    ]
    await renderTasks(tasks)
    renderSuccess({
      body: [{subdued: `${operationType} result file downloaded to:`}, {filePath}],
    })
  }
}
