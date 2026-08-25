import {createMigrationPlan} from './plan/create-migration-plan.js'
import {deriveBatchIdempotencyKey} from './plan/idempotency.js'
import {MigrationSubmissionError, submitMigrationPlan} from './submit-migration-plan.js'
import {describe, expect, test, vi} from 'vitest'
import type {MigrationOperationPayload} from './partners-api.js'
import type {MigrationAction} from '../../models/subscription-migrations.js'

function plan(action: MigrationAction, count = 1) {
  const rows = Array.from({length: count}, (_, index) => ({
    sourceRow: index + 2,
    shopId: String(index + 1),
    ...(action === 'schedule'
      ? {targetPlanHandle: 'pro', priceBehavior: 'PLAN_PRICE', notification: 'WHEN_REQUIRED'}
      : {}),
  }))
  const result = createMigrationPlan(action, rows)
  if (!result.ok) throw new Error('Expected a valid plan')
  return result.plan
}

function payload(id: number, total = 1): MigrationOperationPayload {
  return {
    operation: {
      id: `gid://shopify/AppSubscriptionMigrationOperation/${id}`,
      status: 'RUNNING',
      total,
      results: {edges: []},
    },
    userErrors: [],
  }
}

describe('submitMigrationPlan', () => {
  test('submits schedule batches sequentially in index order', async () => {
    let resolveFirst: ((value: MigrationOperationPayload) => void) | undefined
    const firstOperation = new Promise<MigrationOperationPayload>((resolve) => {
      resolveFirst = resolve
    })
    const createOperation = vi.fn().mockReturnValueOnce(firstOperation).mockResolvedValueOnce(payload(2))
    const migrationPlan = plan('schedule', 251)

    const submissionPromise = submitMigrationPlan({
      clientId: 'client-id',
      plan: migrationPlan,
      rootIdempotencyKey: 'root-key',
      createOperation,
    })

    expect(createOperation).toHaveBeenCalledTimes(1)
    resolveFirst?.(payload(1, 250))
    const submission = await submissionPromise

    expect(createOperation).toHaveBeenCalledTimes(2)
    expect(submission.operations.map(({batchIndex, operation}) => [batchIndex, operation.id])).toEqual([
      [0, 'gid://shopify/AppSubscriptionMigrationOperation/1'],
      [1, 'gid://shopify/AppSubscriptionMigrationOperation/2'],
    ])
  })

  test('uses the root override and records submission and batch metadata', async () => {
    const migrationPlan = plan('schedule')
    const createOperation = vi.fn().mockResolvedValue(payload(1))

    const submission = await submitMigrationPlan({
      clientId: 'client-id',
      plan: migrationPlan,
      rootIdempotencyKey: 'root-key',
      createOperation,
    })

    const batch = migrationPlan.batches[0]!
    const expectedBatchKey = deriveBatchIdempotencyKey({
      appIdentifier: 'client-id',
      action: 'schedule',
      rootKey: 'root-key',
      canonicalBatchPayload: batch.canonicalPayload,
    })
    expect(submission).toEqual({
      clientId: 'client-id',
      action: 'schedule',
      rootIdempotencyKey: 'root-key',
      inputDigest: migrationPlan.inputDigest,
      total: 1,
      operations: [
        {
          batchIndex: 0,
          batchPayloadDigest: batch.payloadDigest,
          idempotencyKey: expectedBatchKey,
          operation: payload(1).operation,
        },
      ],
    })
  })

  test('generates a root idempotency key when none is provided', async () => {
    const createOperation = vi.fn().mockResolvedValue(payload(1))

    const submission = await submitMigrationPlan({clientId: 'client-id', plan: plan('schedule'), createOperation})

    expect(submission.rootIdempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  test('maps schedule rows to schedule API inputs', async () => {
    const createOperation = vi.fn().mockResolvedValue(payload(1))

    await submitMigrationPlan({
      clientId: 'client-id',
      plan: plan('schedule'),
      rootIdempotencyKey: 'root-key',
      createOperation,
    })

    expect(createOperation).toHaveBeenCalledWith({
      clientId: 'client-id',
      idempotencyKey: expect.stringMatching(/^[a-f0-9]{64}$/),
      migrations: [
        {
          shopId: 'gid://shopify/Shop/1',
          action: {
            scheduleMigration: {
              targetPlanHandle: 'pro',
              priceBehavior: 'PLAN_PRICE',
              notification: 'WHEN_REQUIRED',
            },
          },
        },
      ],
    })
  })

  test('maps unschedule rows to cancel API inputs', async () => {
    const createOperation = vi.fn().mockResolvedValue(payload(1))

    await submitMigrationPlan({
      clientId: 'client-id',
      plan: plan('unschedule'),
      rootIdempotencyKey: 'root-key',
      createOperation,
    })

    expect(createOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        migrations: [{shopId: 'gid://shopify/Shop/1', action: {cancelMigration: true}}],
      }),
    )
  })

  test('throws with accepted operations when a later batch has user errors', async () => {
    const acceptedWithErrors = payload(2)
    acceptedWithErrors.userErrors = [{message: 'Rejected remaining shops', field: ['input']}]
    const createOperation = vi.fn().mockResolvedValueOnce(payload(1, 250)).mockResolvedValueOnce(acceptedWithErrors)

    const promise = submitMigrationPlan({
      clientId: 'client-id',
      plan: plan('schedule', 251),
      rootIdempotencyKey: 'root-key',
      createOperation,
    })

    await expect(promise).rejects.toMatchObject({
      name: 'MigrationSubmissionError',
      batchIndex: 1,
      userErrors: [{message: 'Rejected remaining shops', field: ['input']}],
      submission: {
        rootIdempotencyKey: 'root-key',
        operations: [
          {operation: {id: 'gid://shopify/AppSubscriptionMigrationOperation/1'}},
          {operation: {id: 'gid://shopify/AppSubscriptionMigrationOperation/2'}},
        ],
      },
    })
  })

  test('throws with the accepted partial submission when a payload has no operation', async () => {
    const createOperation = vi
      .fn()
      .mockResolvedValueOnce(payload(1, 250))
      .mockResolvedValueOnce({operation: null, userErrors: []})

    const promise = submitMigrationPlan({
      clientId: 'client-id',
      plan: plan('schedule', 251),
      rootIdempotencyKey: 'root-key',
      createOperation,
    })

    await expect(promise).rejects.toBeInstanceOf(MigrationSubmissionError)
    await expect(promise).rejects.toMatchObject({
      batchIndex: 1,
      userErrors: [],
      submission: {operations: [{operation: {id: 'gid://shopify/AppSubscriptionMigrationOperation/1'}}]},
    })
  })
})
