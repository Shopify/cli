import {StagedUploadInput, createStagedUploadAdmin} from '../../../apis/admin/index.js'
import {ValidationError, OperationError, ErrorCodes} from '../errors/errors.js'
import {fetch} from '@shopify/cli-kit/node/http'
import {fileExistsSync, fileSize, isDirectory, readFileSync} from '@shopify/cli-kit/node/fs'

export class FileUploader {
  private readonly MAX_FILE_SIZE = 20 * 1024 * 1024

  async uploadSqliteFile(filePath: string, storeFqdn: string): Promise<string> {
    await this.validateSqliteFile(filePath)

    const fileBuffer = readFileSync(filePath)
    const sizeOfFile = await fileSize(filePath)
    const uploadInput: StagedUploadInput = {
      resource: 'FILE',
      filename: 'database.sqlite',
      mimeType: 'application/x-sqlite3',
      httpMethod: 'POST',
      fileSize: sizeOfFile.toString(),
    }

    const stagedUploadResponse = await createStagedUploadAdmin(storeFqdn, [uploadInput])

    if (!stagedUploadResponse.stagedUploadsCreate?.stagedTargets?.length) {
      throw new OperationError('upload', ErrorCodes.STAGED_UPLOAD_FAILED, {
        reason: 'Failed to create staged upload location',
      })
    }

    const stagedTarget = stagedUploadResponse.stagedUploadsCreate.stagedTargets[0]
    if (!stagedTarget) {
      throw new OperationError('upload', ErrorCodes.STAGED_UPLOAD_FAILED, {
        reason: 'No staged target returned from upload response',
      })
    }
    const {url, resourceUrl, parameters} = stagedTarget

    if (!url || !resourceUrl) {
      throw new OperationError('upload', ErrorCodes.STAGED_UPLOAD_FAILED, {
        reason: 'Missing required fields in staged target',
      })
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
      throw new OperationError('upload', ErrorCodes.FILE_UPLOAD_FAILED, {
        details: `${uploadResponse.status} ${uploadResponse.statusText}. ${errorText}`,
      })
    }

    return resourceUrl
  }

  private async validateSqliteFile(filePath: string): Promise<void> {
    try {
      if (!fileExistsSync(filePath)) {
        throw new ValidationError(ErrorCodes.FILE_NOT_FOUND, {filePath})
      }
      if (await isDirectory(filePath)) {
        throw new ValidationError(ErrorCodes.NOT_A_FILE, {filePath})
      }
      const sizeOfFile = await fileSize(filePath)
      if (sizeOfFile === 0) {
        throw new ValidationError(ErrorCodes.EMPTY_FILE, {filePath})
      }

      if (sizeOfFile > this.MAX_FILE_SIZE) {
        throw new ValidationError(ErrorCodes.FILE_TOO_LARGE, {
          filePath,
          sizeGB: Math.round(sizeOfFile / 1024 / 1024 / 1024),
        })
      }

      const buffer = readFileSync(filePath)
      const header = buffer.subarray(0, 15).toString('utf8')

      if (!header.startsWith('SQLite format 3')) {
        throw new ValidationError(ErrorCodes.INVALID_FILE_FORMAT, {filePath})
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new ValidationError(ErrorCodes.FILE_NOT_FOUND, {filePath})
      }
      throw new ValidationError(ErrorCodes.INVALID_FILE_FORMAT, {filePath})
    }
  }
}
