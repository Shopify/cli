import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import type {MigrationOperation} from '../../models/subscription-migrations.js'

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
