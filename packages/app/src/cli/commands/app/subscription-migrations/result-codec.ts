import {
  migrationCancellationJsonOutputSchema,
  migrationSubmissionJsonOutputSchema,
  type MigrationCancellationResult,
  type MigrationSubmissionResult,
} from '../../../services/subscription-migrations/types.js'

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
  return migrationCancellationJsonOutputSchema.encode({outcomes: result.outcomes})
}
