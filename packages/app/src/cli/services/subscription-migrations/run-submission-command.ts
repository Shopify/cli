import {planMigrationInput} from './plan/plan-migration-input.js'
import {submitMigrationPlan, type MigrationSubmission, type MigrationSubmissionResult} from './submit-migration-plan.js'
import {watchMigrationOperations} from './watch-operations.js'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import type {
  MigrationAction,
  MigrationOperation,
  MigrationValidationError,
} from '../../models/subscription-migrations.js'

interface RunSubmissionCommandOptions {
  action: MigrationAction
  input: string
  clientId: string
  skipConfirmation: boolean
  watch: boolean
  onSubmissionAccepted?: (submission: MigrationSubmission) => void
}

export async function runSubmissionCommand(options: RunSubmissionCommandOptions): Promise<MigrationSubmissionResult> {
  const result = await planMigrationInput(options.action, options.input)
  if (!result.ok) throw new AbortError(formatValidationErrors(result.errors))

  if (!options.skipConfirmation) {
    const confirmed = await renderConfirmationPrompt({
      message: `${options.action === 'schedule' ? 'Schedule' : 'Unschedule'} ${result.plan.rows.length} subscriptions?`,
    })
    if (!confirmed) throw new AbortSilentError()
  }

  const submissionResult = await submitMigrationPlan({
    clientId: options.clientId,
    plan: result.plan,
  })

  if (submissionResult.status === 'failed' || !options.watch) return submissionResult

  options.onSubmissionAccepted?.(submissionResult.submission)
  const terminalOperations = await watchMigrationOperations({
    clientId: options.clientId,
    operationIds: submissionResult.submission.operations.map(({operation}) => operation.id),
  })

  const submission = updateSubmissionOperations(submissionResult.submission, terminalOperations)
  const failedOperationIds = submission.operations
    .filter(({operation}) => operation.status === 'FAILED')
    .map(({operation}) => operation.id)

  return failedOperationIds.length === 0
    ? {status: 'success', submission}
    : {status: 'failed', submission, failure: {type: 'operations', operationIds: failedOperationIds}}
}

function updateSubmissionOperations(
  submission: MigrationSubmission,
  operations: MigrationOperation[],
): MigrationSubmission {
  const operationsById = new Map(operations.map((operation) => [operation.id, operation]))
  return {
    ...submission,
    operations: submission.operations.map((submittedOperation) => ({
      ...submittedOperation,
      operation: operationsById.get(submittedOperation.operation.id) ?? submittedOperation.operation,
    })),
  }
}

function formatValidationErrors(errors: MigrationValidationError[]): string {
  return errors
    .map((error) => {
      const location = [error.row === undefined ? undefined : `row ${error.row}`, error.field]
        .filter((value) => value !== undefined)
        .join(', ')
      return location ? `${location}: ${error.message}` : error.message
    })
    .join('\n')
}
