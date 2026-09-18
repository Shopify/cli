import {
  migrationCancellationJsonOutputSchema,
  migrationSubmissionJsonOutputSchema,
  type MigrationCancellationResult,
  type MigrationSubmissionResult,
} from '../../../services/subscription-migrations/types.js'

export function encodeMigrationSubmissionResult(result: MigrationSubmissionResult): string {
  const document =
    result.status === 'success'
      ? {schemaVersion: 1 as const, ...result.submission}
      : {
          schemaVersion: 1 as const,
          ...result.submission,
          failure: result.failure,
        }
  return migrationSubmissionJsonOutputSchema.encode(document)
}

export function encodeMigrationCancellationResult(result: MigrationCancellationResult): string {
  return migrationCancellationJsonOutputSchema.encode({schemaVersion: 1, outcomes: result.outcomes})
}
