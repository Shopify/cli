import {createMigrationOperation, type MigrationApiInput, type MigrationUserError} from './partners-api.js'
import {deriveBatchIdempotencyKey, generateInvocationId} from './plan/idempotency.js'
import type {
  MigrationOperation,
  MigrationPlan,
  PlannedMigrationRow,
  ScheduledMigrationRow,
} from '../../models/subscription-migrations.js'

export interface SubmittedMigrationOperation {
  batchIndex: number
  batchPayloadDigest: string
  operation: MigrationOperation
}

export interface MigrationSubmission {
  clientId: string
  action: MigrationPlan['action']
  inputDigest: string
  total: number
  operations: SubmittedMigrationOperation[]
}

export type MigrationSubmissionFailure =
  | {type: 'submission'; batchIndex: number; userErrors: MigrationUserError[]}
  | {type: 'operations'; operationIds: string[]}

export type MigrationSubmissionResult =
  | {status: 'success'; submission: MigrationSubmission}
  | {status: 'failed'; submission: MigrationSubmission; failure: MigrationSubmissionFailure}

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
}: SubmitMigrationPlanOptions): Promise<MigrationSubmissionResult> {
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
    // Each accepted batch must be recorded before the next request can fail.
    // eslint-disable-next-line no-await-in-loop
    const payload = await createOperation({
      clientId,
      idempotencyKey,
      migrations: batch.rows.map(toMigrationApiInput),
    })

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
