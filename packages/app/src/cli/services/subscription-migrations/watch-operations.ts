import {formatMigrationOperationsStatus} from './command-output.js'
import {waitForOperations as waitForOperationsDefault} from './wait-for-operations.js'
import {outputContent} from '@shopify/cli-kit/node/output'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import type {MigrationOperation} from '../../models/subscription-migrations.js'

interface WatchMigrationOperationsOptions {
  clientId: string
  operationIds: string[]
  waitForOperations?: typeof waitForOperationsDefault
}

export async function watchMigrationOperations({
  clientId,
  operationIds,
  waitForOperations = waitForOperationsDefault,
}: WatchMigrationOperationsOptions): Promise<MigrationOperation[]> {
  return renderSingleTask<MigrationOperation[]>({
    title: outputContent`Polling subscription migration operations`,
    task: (updateStatus) =>
      waitForOperations({
        clientId,
        operationIds,
        onUpdate: (operations) => updateStatus(outputContent`${formatMigrationOperationsStatus(operations)}`),
      }),
    renderOptions: {stdout: process.stderr},
  })
}
