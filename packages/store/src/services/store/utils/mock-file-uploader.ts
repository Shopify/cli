import {outputInfo} from '@shopify/cli-kit/node/output'
import {fileExists} from '@shopify/cli-kit/node/fs'

export class MockFileUploader {
  async uploadSqliteFile(
    filePath: string,
    storeFqdn: string,
  ): Promise<string> {
    outputInfo(`[MOCK] Uploading SQLite file ${filePath} to ${storeFqdn}...`)
    
    if (!(await fileExists(filePath))) {
      throw new Error(`File not found: ${filePath}`)
    }
    
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    outputInfo(`[MOCK] File uploaded successfully`)
    
    return `https://mock-staged-uploads.shopify.com/files/database-${Date.now()}.sqlite`
  }
}