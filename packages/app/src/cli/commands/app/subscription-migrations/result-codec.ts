import {
  migrationCancellationJsonOutputSchema,
  migrationSubmissionJsonOutputSchema,
  type MigrationCancellationResult,
  type MigrationSubmissionResult,
} from '../../../services/subscription-migrations/types.js'
import {
  projectMigrationOperation,
  projectMigrationUserErrors,
} from '../../../services/subscription-migrations/result-codec.js'
import {errorToJson} from '@shopify/cli-kit/node/error/serialization'

export function encodeMigrationSubmissionResult(result: MigrationSubmissionResult): string {
  const document =
    result.status === 'success'
      ? result.submission
      : {
          ...result.submission,
          failure: result.failure,
        }
  return migrationSubmissionJsonOutputSchema.encode(document)
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
            error:
              'error' in outcome
                ? errorToJson(outcome.error)
                : {
                    type: 'abort' as const,
                    message: outcome.userErrors.map(({message}) => message).join('; '),
                    details: {userErrors: projectMigrationUserErrors(outcome.userErrors)},
                  },
          },
    ),
  })
}
