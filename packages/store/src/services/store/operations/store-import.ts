import {StoreOperation} from '../types/operations.js'
import {FlagOptions} from '../../../lib/types.js'

export class StoreImportOperation implements StoreOperation {
  async execute(fromFile: string, toStore: string, flags: FlagOptions): Promise<void> {
    throw new Error('Store import functionality is not implemented yet')
  }
}
