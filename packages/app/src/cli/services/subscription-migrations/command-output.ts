import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import type {MigrationOperation} from '../../models/subscription-migrations.js'
import type {MigrationSubmission} from './submit-migration-plan.js'

interface OutputSubmissionOptions {
  json: boolean
  partial?: boolean
}

export function outputSubmission(submission: MigrationSubmission, options: OutputSubmissionOptions): void {
  if (options.json) {
    outputResult(JSON.stringify({schemaVersion: 1, ...submission}, null, 2))
    return
  }

  if (options.partial) {
    const operationIds = submission.operations.map(({operation}) => operation.id)
    renderWarning({
      headline: 'Some subscription migration operations were accepted before submission failed.',
      body: [
        `Root idempotency key: ${submission.rootIdempotencyKey}`,
        ...(operationIds.length === 0
          ? ['Accepted operation IDs: None.']
          : ['Accepted operation IDs:', ...operationIds]),
        'Save the root idempotency key and every accepted operation ID. You will need them to check or cancel accepted operations.',
      ],
    })
    return
  }

  const action = submission.action === 'schedule' ? 'scheduled' : 'unscheduled'
  renderSuccess({
    headline: `Subscription migrations ${action}.`,
    body: [
      `Root idempotency key: ${submission.rootIdempotencyKey}`,
      `Shops: ${submission.total}`,
      'Operation IDs:',
      ...submission.operations.map(({operation}) => operation.id),
      'Save the root idempotency key and every operation ID. You will need them to check or cancel this submission.',
    ],
  })
}

export function formatMigrationOperationsStatus(operations: MigrationOperation[]): string {
  return operations.map(formatMigrationOperationStatus).join(' · ')
}

export function outputOperations(operations: MigrationOperation[], json: boolean): void {
  if (json) {
    outputResult(JSON.stringify({schemaVersion: 1, operations}, null, 2))
    return
  }

  renderInfo({
    headline: 'Subscription migration operations.',
    body: operations.map(formatMigrationOperationStatus),
  })
}

function formatMigrationOperationStatus(operation: MigrationOperation): string {
  return `${operation.id}: ${operation.status} (${operation.results.edges.length}/${operation.total} settled)`
}
