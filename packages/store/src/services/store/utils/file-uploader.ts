import {StagedUploadInput, createStagedUploadAdmin} from '../../../apis/admin/index.js'
import {ValidationError, OperationError, ErrorCodes} from '../errors/errors.js'
import {fetch} from '@shopify/cli-kit/node/http'
import {fileExistsSync, fileSize, isDirectory, readFileSync} from '@shopify/cli-kit/node/fs'
import {outputDebug} from '@shopify/cli-kit/node/output'

export class FileUploader {
  private readonly MAX_FILE_SIZE = 300 * 1024 * 1024

  async uploadSqliteFile(filePath: string, storeFqdn: string): Promise<string> {
    await this.validateSqliteFile(filePath)

    const fileBuffer = readFileSync(filePath)
    const sizeOfFile = await fileSize(filePath)
    const uploadInput: StagedUploadInput = {
      resource: 'SQLITE_DATABASE',
      filename: 'database.sqlite',
      mimeType: 'application/x-sqlite3',
      httpMethod: 'POST',
      fileSize: sizeOfFile.toString(),
    }

    const stagedUploadResponse = await createStagedUploadAdmin(storeFqdn, [uploadInput], 'unstable')

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

    const stagedUploadKeyParam = parameters.find((parameter) => parameter.name === 'key')
    if (!stagedUploadKeyParam) {
      throw new OperationError('upload', ErrorCodes.STAGED_UPLOAD_FAILED, {
        reason: 'Missing key parameter in staged upload target',
      })
    }

    const finalResourceUrl = resourceUrl + stagedUploadKeyParam.value

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

    return finalResourceUrl
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
      outputDebug(`Validating SQLite file at ${filePath} with size ${sizeOfFile} bytes`)

      if (sizeOfFile === 0) {
        throw new ValidationError(ErrorCodes.EMPTY_FILE, {filePath})
      }

      if (sizeOfFile > this.MAX_FILE_SIZE) {
        throw new ValidationError(ErrorCodes.FILE_TOO_LARGE, {
          filePath,
          fileSize: `${Math.round(sizeOfFile / 1024 / 1024)}MB`,
          maxSize: `${Math.round(this.MAX_FILE_SIZE / 1024 / 1024)}MB`,
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
