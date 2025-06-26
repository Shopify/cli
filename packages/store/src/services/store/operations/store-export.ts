import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {generateExportFilename} from '../utils/file-utils.js'

export class StoreExportOperation implements StoreOperation {
  async execute(fromStore: string, toFile: string, flags: FlagOptions): Promise<void> {
    throw new Error('Store export functionality is not implemented yet')
  }

  private determineOutputPath(fromStore: string, toFile: string): string {
    if (toFile === '') {
      return generateExportFilename(fromStore)
    }
    return toFile
  }
}
