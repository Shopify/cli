import type {MigrationCancellationResult} from '../../../services/subscription-migrations/cancel-operations.js'
import type {MigrationSubmissionResult} from '../../../services/subscription-migrations/submit-migration-plan.js'

export function encodeMigrationSubmissionResult(result: MigrationSubmissionResult): string {
  const document =
    result.status === 'success'
      ? {schemaVersion: 1, ...result.submission}
      : {
          schemaVersion: 1,
          ...result.submission,
          failure: result.failure,
        }
  return JSON.stringify(document, null, 2)
}

export function encodeMigrationCancellationResult(result: MigrationCancellationResult): string {
  return JSON.stringify({schemaVersion: 1, outcomes: result.outcomes}, null, 2)
}
