import {formatBulkOperationStatus} from './format-bulk-operation-status.js'
import {
  GetBulkOperationById,
  GetBulkOperationByIdQuery,
} from '../../api/graphql/bulk-operations/generated/get-bulk-operation-by-id.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {sleep} from '@shopify/cli-kit/node/system'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {outputContent} from '@shopify/cli-kit/node/output'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {AbortSignal} from '@shopify/cli-kit/node/abort'

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELED', 'EXPIRED']
const INITIAL_POLL_INTERVAL_SECONDS = 1
const REGULAR_POLL_INTERVAL_SECONDS = 5
const INITIAL_POLL_COUNT = 10
const API_VERSION = '2026-01'

export type BulkOperation = NonNullable<GetBulkOperationByIdQuery['bulkOperation']>

export async function watchBulkOperation(
  adminSession: AdminSession,
  operationId: string,
  abortSignal: AbortSignal,
  onAbort: () => void,
): Promise<BulkOperation> {
  return renderSingleTask<BulkOperation>({
    title: outputContent`Polling bulk operation...`,
    task: async (updateStatus) => {
      const poller = pollBulkOperation(adminSession, operationId, abortSignal)

      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const {value: latestOperationState, done} = await poller.next()
        if (done) {
          return latestOperationState
        } else {
          updateStatus(formatBulkOperationStatus(latestOperationState))
        }
      }
    },
    onAbort,
    renderOptions: {stdout: process.stderr},
  })
}

async function* pollBulkOperation(
  adminSession: AdminSession,
  operationId: string,
  abortSignal: AbortSignal,
): AsyncGenerator<BulkOperation, BulkOperation> {
  let pollCount = 0

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const response = await fetchBulkOperation(adminSession, operationId)

    if (!response.bulkOperation) {
      throw new Error('bulk operation not found')
    }

    const latestOperationState = response.bulkOperation

    if (TERMINAL_STATUSES.includes(latestOperationState.status) || abortSignal.aborted) {
      return latestOperationState
    } else {
      yield latestOperationState
    }

    pollCount++

    // Use shorter interval for the first 10 polls, then switch to regular interval
    const pollInterval = pollCount <= INITIAL_POLL_COUNT ? INITIAL_POLL_INTERVAL_SECONDS : REGULAR_POLL_INTERVAL_SECONDS

    // eslint-disable-next-line no-await-in-loop
    await Promise.race([sleep(pollInterval), new Promise((resolve) => abortSignal.addEventListener('abort', resolve))])
  }
}

async function fetchBulkOperation(adminSession: AdminSession, operationId: string): Promise<GetBulkOperationByIdQuery> {
  return adminRequestDoc<GetBulkOperationByIdQuery, {id: string}>({
    query: GetBulkOperationById,
    session: adminSession,
    variables: {id: operationId},
    version: API_VERSION,
  })
}
