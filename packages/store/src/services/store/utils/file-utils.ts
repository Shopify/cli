import {dirname} from '@shopify/cli-kit/node/path'
import {access, constants} from 'fs/promises'

export async function validateFileExists(filePath: string): Promise<void> {
  try {
    await access(filePath, constants.F_OK)
  } catch {
    throw new Error(`File not found: ${filePath}`)
  }
}

export async function validateDirectoryWritable(filePath: string): Promise<void> {
  const directory = dirname(filePath)
  try {
    await access(directory, constants.W_OK)
  } catch {
    throw new Error(`Directory is not writable: ${directory}`)
  }
}

export async function validateFileDoesNotExist(filePath: string): Promise<void> {
  try {
    await access(filePath, constants.F_OK)
    throw new Error(`File already exists: ${filePath}`)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('File already exists')) {
      throw error
    }
  }
}

export function generateExportFilename(storeDomain: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const storeName = storeDomain.replace('.myshopify.com', '')
  return `${storeName}_${timestamp}.sqlite`
}
