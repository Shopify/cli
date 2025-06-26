import {FlagOptions} from '../../../lib/types.js'

export enum OperationMode {
  STORE_COPY = 'STORE_COPY',
  STORE_EXPORT = 'STORE_EXPORT',
  STORE_IMPORT = 'STORE_IMPORT',
}

export interface StoreOperation {
  execute(source: string, target: string, flags: FlagOptions): Promise<void>
}
