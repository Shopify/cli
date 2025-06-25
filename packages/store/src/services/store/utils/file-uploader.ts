import {StagedUploadInput, createStagedUploadAdmin} from '../../../apis/admin/index.js'
import {fetch} from '@shopify/cli-kit/node/http'
import {readFileSync, statSync} from 'node:fs'

export class FileUploader {
  async uploadSqliteFile(filePath: string, storeFqdn: string): Promise<string> {
    this.validateSqliteFile(filePath)

    const fileStats = statSync(filePath)
    const fileBuffer = readFileSync(filePath)

    const uploadInput: StagedUploadInput = {
      resource: 'FILE',
      filename: 'database.sqlite',
      mimeType: 'application/x-sqlite3',
      httpMethod: 'POST',
      fileSize: fileStats.size.toString(),
    }

    const stagedUploadResponse = await createStagedUploadAdmin(storeFqdn, [uploadInput])

    if (!stagedUploadResponse.stagedUploadsCreate?.stagedTargets?.length) {
      throw new Error('Failed to create staged upload location')
    }

    const stagedTarget = stagedUploadResponse.stagedUploadsCreate.stagedTargets[0]
    if (!stagedTarget) {
      throw new Error('No staged target returned from upload response')
    }
    const {url, resourceUrl, parameters} = stagedTarget

    if (!url || !resourceUrl) {
      throw new Error('Missing required fields in staged target')
    }

    const formData = new FormData()

    parameters.forEach((param) => {
      formData.append(param.name, param.value)
    })

    const blob = new Blob([fileBuffer], {type: 'application/x-sqlite3'})
    formData.append('file', blob, 'database.sqlite')

    const uploadResponse = await fetch(url, {
      method: 'POST',
      body: formData,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      throw new Error(`File upload failed: ${uploadResponse.status} ${uploadResponse.statusText}. ${errorText}`)
    }

    return resourceUrl
  }

  private validateSqliteFile(filePath: string): void {
    try {
      const stats = statSync(filePath)

      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`)
      }

      if (stats.size === 0) {
        throw new Error(`File is empty: ${filePath}`)
      }

      if (stats.size > 5 * 1024 * 1024 * 1024) {
        throw new Error(`File is too large (${Math.round(stats.size / 1024 / 1024 / 1024)}GB). Maximum size is 5GB.`)
      }

      const buffer = readFileSync(filePath)
      const header = buffer.subarray(0, 15).toString('utf8')

      if (!header.startsWith('SQLite format 3')) {
        throw new Error(`File does not appear to be a valid SQLite database: ${filePath}`)
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Failed to validate file: ${filePath}`)
    }
  }
}
