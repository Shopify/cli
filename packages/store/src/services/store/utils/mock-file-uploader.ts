import {fileExists} from '@shopify/cli-kit/node/fs'

export class MockFileUploader {
  async uploadSqliteFile(filePath: string, _storeFqdn: string): Promise<string> {
    if (!(await fileExists(filePath))) {
      throw new Error(`File not found: ${filePath}`)
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))

    return `https://mock-staged-uploads.shopify.com/files/database-${Date.now()}.sqlite`
  }
}
