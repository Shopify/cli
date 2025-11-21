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

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELED', 'EXPIRED']
const POLL_INTERVAL_SECONDS = 5
const API_VERSION = '2026-01'

export type BulkOperation = NonNullable<GetBulkOperationByIdQuery['bulkOperation']>

export async function watchBulkOperation(adminSession: AdminSession, operationId: string): Promise<BulkOperation> {
  return renderSingleTask<BulkOperation>({
    title: outputContent`Polling bulk operation...`,
    task: async (updateStatus) => {
      const poller = pollBulkOperation(adminSession, operationId)

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
  })
}

async function* pollBulkOperation(
  adminSession: AdminSession,
  operationId: string,
): AsyncGenerator<BulkOperation, BulkOperation> {
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const response = await fetchBulkOperation(adminSession, operationId)

    if (!response.bulkOperation) {
      throw new Error('bulk operation not found')
    }

    const latestOperationState = response.bulkOperation

    if (TERMINAL_STATUSES.includes(latestOperationState.status)) {
      return latestOperationState
    } else {
      yield latestOperationState
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(POLL_INTERVAL_SECONDS)
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
