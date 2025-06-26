import {FlagOptions} from '../../../lib/types.js'

export enum OperationMode {
  STORE_COPY = 'STORE_COPY',
  STORE_EXPORT = 'STORE_EXPORT',
  STORE_IMPORT = 'STORE_IMPORT',
}

export interface StoreOperation {
  execute(from: string, to: string | undefined, flags: FlagOptions): Promise<void>
}
