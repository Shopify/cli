import {formatBulkOperationStatus} from './format-bulk-operation-status.js'
import {BULK_OPERATIONS_MIN_API_VERSION} from './constants.js'
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

export const QUICK_WATCH_TIMEOUT_MS = 3000
export const QUICK_WATCH_POLL_INTERVAL_MS = 300

export type BulkOperation = NonNullable<GetBulkOperationByIdQuery['bulkOperation']>

export async function shortBulkOperationPoll(adminSession: AdminSession, operationId: string): Promise<BulkOperation> {
  return renderSingleTask<BulkOperation>({
    title: outputContent`Starting bulk operation...`,
    task: async () => {
      const startTime = Date.now()
      const poller = pollBulkOperation({
        adminSession,
        operationId,
        pollIntervalSeconds: QUICK_WATCH_POLL_INTERVAL_MS / 1000,
        useAdaptivePolling: false,
      })

      let latestOperationState: BulkOperation | undefined

      do {
        // eslint-disable-next-line no-await-in-loop
        const {value, done} = await poller.next()
        latestOperationState = value
        if (done) return latestOperationState
      } while (Date.now() - startTime < QUICK_WATCH_TIMEOUT_MS)

      return latestOperationState
    },
    renderOptions: {stdout: process.stderr},
  })
}

export async function watchBulkOperation(
  adminSession: AdminSession,
  operationId: string,
  abortSignal: AbortSignal,
  onAbort: () => void,
): Promise<BulkOperation> {
  return renderSingleTask<BulkOperation>({
    title: outputContent`Polling bulk operation...`,
    task: async (updateStatus) => {
      const poller = pollBulkOperation({
        adminSession,
        operationId,
        pollIntervalSeconds: REGULAR_POLL_INTERVAL_SECONDS,
        initialPollIntervalSeconds: INITIAL_POLL_INTERVAL_SECONDS,
        initialPollCount: INITIAL_POLL_COUNT,
        useAdaptivePolling: true,
        abortSignal,
      })

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

interface PollBulkOperationOptions {
  adminSession: AdminSession
  operationId: string
  pollIntervalSeconds: number
  /** When true, polls faster initially then slows to pollIntervalSeconds */
  useAdaptivePolling?: boolean
  /** Poll interval in seconds for initial fast polls (default: 1) */
  initialPollIntervalSeconds?: number
  /** Number of fast polls before switching to regular interval (default: 10) */
  initialPollCount?: number
  abortSignal?: AbortSignal
}

async function* pollBulkOperation({
  adminSession,
  operationId,
  pollIntervalSeconds,
  useAdaptivePolling = false,
  initialPollIntervalSeconds = INITIAL_POLL_INTERVAL_SECONDS,
  initialPollCount = INITIAL_POLL_COUNT,
  abortSignal,
}: PollBulkOperationOptions): AsyncGenerator<BulkOperation, BulkOperation> {
  let pollCount = 0

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const response = await fetchBulkOperation(adminSession, operationId)

    if (!response.bulkOperation) {
      throw new Error('bulk operation not found')
    }

    const latestOperationState = response.bulkOperation

    if (TERMINAL_STATUSES.includes(latestOperationState.status) || abortSignal?.aborted) {
      return latestOperationState
    } else {
      yield latestOperationState
    }

    pollCount++
    let pollInterval = pollIntervalSeconds
    if (useAdaptivePolling && pollCount <= initialPollCount) {
      pollInterval = initialPollIntervalSeconds
    }

    if (abortSignal) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.race([
        sleep(pollInterval),
        new Promise((resolve) => abortSignal.addEventListener('abort', resolve)),
      ])
    } else {
      // eslint-disable-next-line no-await-in-loop
      await sleep(pollInterval)
    }
  }
}

async function fetchBulkOperation(adminSession: AdminSession, operationId: string): Promise<GetBulkOperationByIdQuery> {
  return adminRequestDoc<GetBulkOperationByIdQuery, {id: string}>({
    query: GetBulkOperationById,
    session: adminSession,
    variables: {id: operationId},
    version: BULK_OPERATIONS_MIN_API_VERSION,
  })
}
