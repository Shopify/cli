import {createMigrationOperation, type MigrationApiInput, type MigrationUserError} from './partners-api.js'
import {deriveBatchIdempotencyKey, generateRootIdempotencyKey} from './plan/idempotency.js'
import type {
  MigrationOperation,
  MigrationPlan,
  PlannedMigrationRow,
  ScheduledMigrationRow,
} from '../../models/subscription-migrations.js'

export interface SubmittedMigrationOperation {
  batchIndex: number
  batchPayloadDigest: string
  idempotencyKey: string
  operation: MigrationOperation
}

export interface MigrationSubmission {
  clientId: string
  action: MigrationPlan['action']
  rootIdempotencyKey: string
  inputDigest: string
  total: number
  operations: SubmittedMigrationOperation[]
}

export class MigrationSubmissionError extends Error {
  readonly submission: MigrationSubmission
  readonly batchIndex: number
  readonly userErrors: MigrationUserError[]

  constructor(submission: MigrationSubmission, batchIndex: number, userErrors: MigrationUserError[]) {
    const details = userErrors.map(({message}) => message).join('; ') || 'Migration operation was not returned'
    super(`Failed to submit migration batch ${batchIndex}: ${details}`)
    this.name = 'MigrationSubmissionError'
    this.submission = submission
    this.batchIndex = batchIndex
    this.userErrors = userErrors
  }
}

interface SubmitMigrationPlanOptions {
  clientId: string
  plan: MigrationPlan
  rootIdempotencyKey?: string
  createOperation?: typeof createMigrationOperation
}

export async function submitMigrationPlan({
  clientId,
  plan,
  rootIdempotencyKey = generateRootIdempotencyKey(),
  createOperation = createMigrationOperation,
}: SubmitMigrationPlanOptions): Promise<MigrationSubmission> {
  const submission: MigrationSubmission = {
    clientId,
    action: plan.action,
    rootIdempotencyKey,
    inputDigest: plan.inputDigest,
    total: plan.rows.length,
    operations: [],
  }

  for (const batch of plan.batches) {
    const idempotencyKey = deriveBatchIdempotencyKey({
      appIdentifier: clientId,
      action: plan.action,
      rootKey: rootIdempotencyKey,
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
        idempotencyKey,
        operation: payload.operation,
      })
    }

    if (!payload.operation || payload.userErrors.length > 0) {
      throw new MigrationSubmissionError(submission, batch.index, payload.userErrors)
    }
  }

  return submission
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
