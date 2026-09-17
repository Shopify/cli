import {
  migrationCancellationJsonOutputSchema,
  type MigrationCancellationResult,
} from '../../../services/subscription-migrations/types.js'
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
  return migrationCancellationJsonOutputSchema.encode({outcomes: result.outcomes})
}
