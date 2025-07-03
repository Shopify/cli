import {ValidationError, ErrorCodes} from '../errors/errors.js'
import {fileExists} from '@shopify/cli-kit/node/fs'

export class MockFileUploader {
  async uploadSqliteFile(filePath: string, _storeFqdn: string): Promise<string> {
    if (!(await fileExists(filePath))) {
      throw new ValidationError(ErrorCodes.FILE_NOT_FOUND, {filePath})
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))

    return `https://mock-staged-uploads.shopify.com/files/database-${Date.now()}.sqlite`
  }
}
