import {BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {downloadFile} from '@shopify/cli-kit/node/http'
import {joinPath, cwd} from '@shopify/cli-kit/node/path'
import {exec} from '@shopify/cli-kit/node/system'
import {fileExists} from '@shopify/cli-kit/node/fs'

export class ResultFileHandler {
  async promptAndHandleResultFile(
    operation: BulkDataOperationByIdResponse,
    operationType: 'export' | 'import',
    storeName?: string,
  ): Promise<void> {
    const storeOperations = operation.organization.bulkData.operation.storeOperations
    const downloadUrl = storeOperations.find((op) => op.url)?.url

    if (!downloadUrl) {
      outputInfo(`${operationType} completed, but no result file available.`)
      return
    }

    const shouldDownload = await renderConfirmationPrompt({
      message: `Press Enter to download the ${operationType} result file.`,
      confirmationMessage: 'Download',
      cancellationMessage: 'Skip',
    })

    if (shouldDownload) {
      await this.downloadAndProcessResultFile(downloadUrl, operationType, storeName)
    }
  }

  private async downloadAndProcessResultFile(url: string, operationType: string, storeName?: string): Promise<void> {
    try {
      const isCompressed = url.includes('.gz')
      const extension = isCompressed ? '.sqlite.gz' : '.sqlite'
      const storePrefix = storeName ? `${storeName}-` : ''
      const filename = `${storePrefix}${operationType}-result-${Date.now()}${extension}`
      const filepath = joinPath(cwd(), filename)

      outputInfo(`Downloading ${operationType} result file to ${filename}...`)
      await downloadFile(url, filepath)
      outputInfo(`${operationType} result file saved to: ${filepath}`)

      const sqliteFilepath = await this.processSqliteFile(filepath)
      if (sqliteFilepath) {
        await this.promptToOpenInSqlite(sqliteFilepath)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      outputInfo(`Failed to download ${operationType} result file: ${errorMessage}`)
      outputInfo(`Download URL: ${url}`)
    }
  }

  private async processSqliteFile(filepath: string): Promise<string | null> {
    try {
      if (filepath.endsWith('.gz')) {
        return await this.gunzipFile(filepath)
      }

      if (await fileExists(filepath)) {
        return filepath
      }

      return null
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      outputInfo(`Failed to process SQLite file: ${errorMessage}`)
      return null
    }
  }

  private async gunzipFile(compressedFilepath: string): Promise<string | null> {
    try {
      const uncompressedFilepath = compressedFilepath.replace('.gz', '')

      outputInfo(`Extracting ${compressedFilepath}...`)
      await exec('gunzip', [compressedFilepath])

      if (await fileExists(uncompressedFilepath)) {
        outputInfo(`Extracted to: ${uncompressedFilepath}`)
        return uncompressedFilepath
      }

      return null
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      outputInfo(`Failed to extract file: ${errorMessage}`)
      outputInfo(`You can manually extract with: gunzip "${compressedFilepath}"`)
      return null
    }
  }

  private async promptToOpenInSqlite(filepath: string): Promise<void> {
    const shouldOpen = await renderConfirmationPrompt({
      message: 'Would you like to open the database file in SQLite?',
      confirmationMessage: 'Open in SQLite',
      cancellationMessage: 'Skip',
    })

    if (shouldOpen) {
      await this.openInSqlite(filepath)
    }
  }

  private async openInSqlite(filepath: string): Promise<void> {
    try {
      outputInfo(`Opening ${filepath} in SQLite...`)
      await exec('open', [filepath])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      outputInfo(`Failed to open in SQLite: ${errorMessage}`)
      outputInfo(`You can manually open the file with: sqlite3 "${filepath}"`)
    }
  }
}