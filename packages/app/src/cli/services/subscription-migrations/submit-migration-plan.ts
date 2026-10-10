import {createMigrationOperation, type MigrationApiInput} from './partners-api.js'
import {deriveBatchIdempotencyKey, generateInvocationId} from './plan/idempotency.js'
import type {MigrationSubmission, MigrationSubmissionResult} from './types.js'
import type {MigrationPlan, PlannedMigrationRow, ScheduledMigrationRow} from '../../models/subscription-migrations.js'

export class MigrationSubmissionProtocolError extends Error {
  readonly batchIndex: number

  constructor(batchIndex: number) {
    super(`Migration submission batch ${batchIndex} returned neither an operation nor user errors`)
    this.name = 'MigrationSubmissionProtocolError'
    this.batchIndex = batchIndex
  }
}

interface SubmitMigrationPlanOptions {
  clientId: string
  plan: MigrationPlan
  invocationId?: string
  createOperation?: typeof createMigrationOperation
}

export async function submitMigrationPlan({
  clientId,
  plan,
  invocationId = generateInvocationId(),
  createOperation = createMigrationOperation,
}: SubmitMigrationPlanOptions): Promise<Exclude<MigrationSubmissionResult, {status: 'cancelled'}>> {
  const submission: MigrationSubmission = {
    clientId,
    action: plan.action,
    inputDigest: plan.inputDigest,
    total: plan.rows.length,
    operations: [],
  }

  for (const batch of plan.batches) {
    const idempotencyKey = deriveBatchIdempotencyKey({
      appIdentifier: clientId,
      action: plan.action,
      invocationId,
      canonicalBatchPayload: batch.canonicalPayload,
    })
    // Keep accepted work when a later request fails so callers can still inspect and cancel it.
    let payload: Awaited<ReturnType<typeof createOperation>>
    try {
      // eslint-disable-next-line no-await-in-loop
      payload = await createOperation({
        clientId,
        idempotencyKey,
        migrations: batch.rows.map(toMigrationApiInput),
      })
    } catch (error) {
      if (submission.operations.length === 0) throw error
      return {
        status: 'failed',
        submission,
        failure: {
          type: 'submission',
          batchIndex: batch.index,
          userErrors: [{message: error instanceof Error ? error.message : 'Migration request failed.', field: null}],
        },
      }
    }

    if (payload.operation) {
      submission.operations.push({
        batchIndex: batch.index,
        batchPayloadDigest: batch.payloadDigest,
        operation: payload.operation,
      })
    }

    if (payload.userErrors.length > 0) {
      return {
        status: 'failed',
        submission,
        failure: {type: 'submission', batchIndex: batch.index, userErrors: payload.userErrors},
      }
    }

    if (!payload.operation) throw new MigrationSubmissionProtocolError(batch.index)
  }

  return {status: 'success', submission}
}

function toMigrationApiInput(row: PlannedMigrationRow): MigrationApiInput {
  if (row.action === 'unschedule') {
    return {shopId: row.shopId, action: {cancelMigration: true}}
  }

  return {shopId: row.shopId, action: {scheduleMigration: scheduleMigrationInput(row)}}
}

function scheduleMigrationInput({
  targetPlanHandle,
  priceBehavior,
  notification,
}: ScheduledMigrationRow): Extract<MigrationApiInput['action'], {scheduleMigration: unknown}>['scheduleMigration'] {
  return {targetPlanHandle, priceBehavior, notification}
}
