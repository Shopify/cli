import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'
import {generateExportFilename} from '../utils/file-utils.js'

export class StoreExportOperation implements StoreOperation {
  async execute(from: string, to: string, flags: FlagOptions): Promise<void> {
    // TODO: Implement actual export logic
    throw new Error('Store export functionality is not implemented yet')
  }

  private determineOutputPath(from: string, to: string): string {
    if (to === '<sqlite>') {
      return generateExportFilename(from)
    }
    return to
  }
}
