/**
 * Shared primitives for running Admin API bulk operations.
 *
 * These are auth-agnostic: callers provide an `AdminSession` (however they obtained it —
 * app client credentials, a stored store session, etc.) and these helpers handle starting,
 * watching, fetching, cancelling, downloading, and formatting bulk operations.
 */
export {BULK_OPERATIONS_MIN_API_VERSION} from './bulk-operations/constants.js'
export {
  normalizeBulkOperationId,
  extractBulkOperationId,
  isMutation,
  validateSingleOperation,
  resolveApiVersion,
} from './bulk-operations/helpers.js'
export {runBulkOperationQuery} from './bulk-operations/run-query.js'
export {runBulkOperationMutation} from './bulk-operations/run-mutation.js'
export {stageFile} from './bulk-operations/stage-file.js'
export {fetchBulkOperationById, fetchRecentBulkOperations} from './bulk-operations/fetch.js'
export {cancelBulkOperationRequest} from './bulk-operations/cancel.js'
export {
  watchBulkOperation,
  shortBulkOperationPoll,
  QUICK_WATCH_TIMEOUT_MS,
  QUICK_WATCH_POLL_INTERVAL_MS,
  type BulkOperation,
} from './bulk-operations/watch-bulk-operation.js'
export {
  downloadBulkOperationResults,
  resultsContainUserErrors,
} from './bulk-operations/download-bulk-operation-results.js'
export {
  formatBulkOperationStatus,
  renderBulkOperationUserErrors,
  formatBulkOperationCancellationResult,
  type BulkOperationCancellationResult,
} from './bulk-operations/format-bulk-operation-status.js'
