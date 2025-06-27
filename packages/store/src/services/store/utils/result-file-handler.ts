import {BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {FlagOptions} from '../../../lib/types.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderConfirmationPrompt, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {downloadFile} from '@shopify/cli-kit/node/http'
import {exec} from '@shopify/cli-kit/node/system'
import {fileExists} from '@shopify/cli-kit/node/fs'

export class ResultFileHandler {
  async promptAndHandleResultFile(
    operation: BulkDataOperationByIdResponse,
    operationType: 'export' | 'import',
    storeName: string,
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
      flags.skipConfirmation ||
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
    const downloadedFilepath = isCompressed && !filePath.endsWith('.gz') ? `${filePath}.gz` : filePath

    const tasks = [
      {
        title: `downloading ${operationType} result file`,
        task: async () => {
          await new Promise((resolve) => setTimeout(resolve, 3000))
          await downloadFile(url, downloadedFilepath)
        },
      },
      {
        title: `processing ${operationType} result file`,
        task: async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          if (isCompressed) {
            await this.gunzipFile(downloadedFilepath)
          }
        },
      },
    ]
    await renderTasks(tasks)
    renderSuccess({
      body: [{subdued: `${operationType} result file downloaded to:`}, {filePath}],
    })
  }

  private async processSqliteFile(filepath: string): Promise<string | null> {
    if (filepath.endsWith('.gz')) {
      return this.gunzipFile(filepath)
    }

    if (await fileExists(filepath)) {
      return filepath
    }

    return null
  }

  private async gunzipFile(compressedFilepath: string): Promise<string | null> {
    const uncompressedFilepath = compressedFilepath.replace('.gz', '')

    outputInfo(`Extracting ${compressedFilepath}...`)
    await exec('gunzip', ['-f', compressedFilepath])

    if (await fileExists(uncompressedFilepath)) {
      outputInfo(`Extracted to: ${uncompressedFilepath}`)
      return uncompressedFilepath
    }

    return null
  }
}
