import {
  migrationCancellationJsonOutputSchema,
  type MigrationCancellationResult,
} from '../../../services/subscription-migrations/types.js'
import {
  projectMigrationOperation,
  projectMigrationUserErrors,
} from '../../../services/subscription-migrations/result-codec.js'
import type {MigrationSubmissionResult} from '../../../services/subscription-migrations/submit-migration-plan.js'

export function encodeMigrationSubmissionResult(result: MigrationSubmissionResult): string {
  const document =
    result.status === 'success'
      ? result.submission
      : {
          ...result.submission,
          failure: result.failure,
        }
  return JSON.stringify(document, null, 2)
}

export function encodeMigrationCancellationResult(result: MigrationCancellationResult): string {
  return migrationCancellationJsonOutputSchema.encode({
    status: result.outcomes.some(({status}) => status === 'failed') ? 'partial' : 'success',
    operations: result.outcomes.map((outcome) =>
      outcome.status === 'success'
        ? {
            status: outcome.status,
            operationGid: outcome.operationId,
            operation: projectMigrationOperation(outcome.operation),
          }
        : {
            status: outcome.status,
            operationGid: outcome.operationId,
            operation: outcome.operation === null ? null : projectMigrationOperation(outcome.operation),
            error: {
              type: 'abort' as const,
              message: outcome.userErrors.map(({message}) => message).join('; '),
              details: {userErrors: projectMigrationUserErrors(outcome.userErrors)},
            },
          },
    ),
  })
}
