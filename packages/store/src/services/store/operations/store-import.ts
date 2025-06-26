import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'

export class StoreImportOperation implements StoreOperation {
  async execute(fromFile: string, toStore: string, flags: FlagOptions): Promise<void> {
    // TODO: Implement actual import logic
    throw new Error('Store import functionality is not implemented yet')

    // Future implementation will validate file exists
    // await validateFileExists(fromFile)
  }
}
