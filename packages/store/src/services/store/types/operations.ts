import {FlagOptions} from '../../../lib/types.js'

export enum OperationMode {
  StoreCopy = 'STORE_COPY',
  StoreExport = 'STORE_EXPORT',
  StoreImport = 'STORE_IMPORT',
}

export interface StoreOperation {
  execute(source: string, target: string, flags: FlagOptions): Promise<void>
}
