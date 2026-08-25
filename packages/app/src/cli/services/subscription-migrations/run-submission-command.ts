import {outputOperations, outputSubmission} from './command-output.js'
import {planMigrationInput} from './plan/plan-migration-input.js'
import {MigrationSubmissionError, submitMigrationPlan, type MigrationSubmission} from './submit-migration-plan.js'
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
  rootIdempotencyKey?: string
  skipConfirmation: boolean
  json: boolean
  watch: boolean
}

export async function runSubmissionCommand(options: RunSubmissionCommandOptions): Promise<void> {
  const result = await planMigrationInput(options.action, options.input)
  if (!result.ok) throw new AbortError(formatValidationErrors(result.errors))

  if (!options.skipConfirmation) {
    const confirmed = await renderConfirmationPrompt({
      message: `${options.action === 'schedule' ? 'Schedule' : 'Unschedule'} ${result.plan.rows.length} subscriptions?`,
    })
    if (!confirmed) throw new AbortSilentError()
  }

  let submission: MigrationSubmission
  try {
    submission = await submitMigrationPlan({
      clientId: options.clientId,
      plan: result.plan,
      ...(options.rootIdempotencyKey === undefined ? {} : {rootIdempotencyKey: options.rootIdempotencyKey}),
    })
  } catch (error) {
    if (error instanceof MigrationSubmissionError) {
      outputSubmission(error.submission, {json: options.json, partial: true})
    }
    throw error
  }

  if (!options.watch) {
    outputSubmission(submission, {json: options.json})
    return
  }

  if (!options.json) outputSubmission(submission, {json: false})

  const terminalOperations = await watchMigrationOperations({
    clientId: options.clientId,
    operationIds: submission.operations.map(({operation}) => operation.id),
  })

  if (options.json) {
    outputSubmission(updateSubmissionOperations(submission, terminalOperations), {json: true})
  } else {
    outputOperations(terminalOperations, false)
  }
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
