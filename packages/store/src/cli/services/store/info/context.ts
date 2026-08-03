import type {StoreInfoExecutionContext} from './types.js'
import type {SyncDiagnosticChannel} from '@shopify/diagnostics'

const noopSyncDiagnosticChannel: SyncDiagnosticChannel = {emit: () => {}}

export const defaultStoreInfoExecutionContext: StoreInfoExecutionContext = {
  diagnostics: noopSyncDiagnosticChannel,
}
