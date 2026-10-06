import {encodeMigrationCancellationResult, encodeMigrationSubmissionResult} from './result-codec.js'
import {
  migrationCancellationJsonOutputSchema,
  migrationSubmissionJsonOutputSchema,
} from '../../../services/subscription-migrations/types.js'
import {describe, expect, test} from 'vitest'
import type {MigrationOperation} from '../../../models/subscription-migrations.js'
import type {
  MigrationCancellationResult,
  MigrationSubmission,
  MigrationSubmissionResult,
} from '../../../services/subscription-migrations/types.js'

function operation(id: string): MigrationOperation {
  return {id, status: 'RUNNING', total: 1, results: {edges: []}}
}

function submission(): MigrationSubmission {
  return {
    clientId: 'client-id',
    action: 'schedule',
    inputDigest: 'input-digest',
    total: 1,
    operations: [
      {
        batchIndex: 0,
        batchPayloadDigest: 'batch-digest',
        operation: operation('gid://shopify/AppSubscriptionMigrationOperation/operation-one'),
      },
    ],
  }
}

describe('subscription migration result codecs', () => {
  const publicSubmission = {
    clientId: 'client-id',
    action: 'schedule',
    inputDigest: 'input-digest',
    total: 1,
    operations: [
      {
        batchIndex: 0,
        batchPayloadDigest: 'batch-digest',
        operation: {
          gid: 'gid://shopify/AppSubscriptionMigrationOperation/operation-one',
          status: 'RUNNING',
          total: 1,
          results: [],
        },
      },
    ],
  }

  test('encodes a successful submission with the public projection', () => {
    const document = encodeMigrationSubmissionResult({status: 'success', submission: submission()})
    const expected = {status: 'success', changed: true, ...publicSubmission}
    expect(JSON.parse(document)).toEqual(expected)
    expect(document).toBe(JSON.stringify(expected, null, 2))
    expect(document).not.toContain('idempotencyKey')
  })

  test('retains accepted work and projects submission diagnostics', () => {
    const result: MigrationSubmissionResult = {
      status: 'failed',
      submission: submission(),
      failure: {
        type: 'submission',
        batchIndex: 1,
        userErrors: [{message: 'Rejected remaining shops', field: ['input']}],
      },
    }
    expect(JSON.parse(encodeMigrationSubmissionResult(result))).toEqual({
      status: 'partial',
      changed: true,
      ...publicSubmission,
      failure: {
        type: 'submission',
        batchIndex: 1,
        userErrors: [{message: 'Rejected remaining shops', fieldPath: ['input']}],
      },
    })
  })

  test('retains terminal upstream failure states inside the resource', () => {
    const value = submission()
    value.operations[0]!.operation.status = 'FAILED'
    const result: MigrationSubmissionResult = {
      status: 'failed',
      submission: value,
      failure: {
        type: 'operations',
        operationIds: ['gid://shopify/AppSubscriptionMigrationOperation/operation-one'],
      },
    }
    expect(JSON.parse(encodeMigrationSubmissionResult(result))).toEqual({
      status: 'partial',
      changed: true,
      ...publicSubmission,
      operations: [
        {
          ...publicSubmission.operations[0],
          operation: {...publicSubmission.operations[0]!.operation, status: 'FAILED'},
        },
      ],
      failure: {type: 'operations', operationGids: ['gid://shopify/AppSubscriptionMigrationOperation/operation-one']},
    })
  })

  test('rejects cancellation documents with an invalid outcome', () => {
    expect(() =>
      migrationCancellationJsonOutputSchema.validate({
        status: 'success',
        operations: [
          {status: 'success', operationGid: 'gid://shopify/AppSubscriptionMigrationOperation/one', operation: null},
        ],
      }),
    ).toThrow()
  })

  test('rejects extra resource fields, invalid GIDs, and negative counts', () => {
    const operationResult = {
      gid: 'gid://shopify/AppSubscriptionMigrationOperation/1',
      status: 'RUNNING',
      total: 0,
      results: [],
    }
    for (const invalid of [
      {...operationResult, accidental: true},
      {...operationResult, gid: '1'},
      {...operationResult, total: -1},
      {...operationResult, total: 0.5},
      {...operationResult, results: [{shopGid: '1', code: 'SCHEDULED'}]},
    ]) {
      expect(() =>
        migrationCancellationJsonOutputSchema.validate({
          status: 'success',
          operations: [{status: 'success', operationGid: operationResult.gid, operation: invalid}],
        }),
      ).toThrow()
    }
  })

  test('encodes an empty cancellation collection as an object', () => {
    expect(JSON.parse(encodeMigrationCancellationResult({outcomes: []}))).toEqual({status: 'success', operations: []})
  })

  test('encodes every cancellation outcome in one JSON document', () => {
    const result: MigrationCancellationResult = {
      outcomes: [
        {
          status: 'success',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/one',
          operation: operation('gid://shopify/AppSubscriptionMigrationOperation/one'),
        },
        {
          status: 'failed',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/two',
          operation: operation('gid://shopify/AppSubscriptionMigrationOperation/two'),
          userErrors: [{message: 'Already completed', field: ['id']}],
        },
        {
          status: 'failed',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/three',
          operation: null,
          userErrors: [{message: 'Operation not found', field: null}],
        },
      ],
    }

    const document = encodeMigrationCancellationResult(result)

    expect(JSON.parse(document)).toEqual({
      status: 'partial',
      operations: result.outcomes.map((outcome) => ({
        status: outcome.status,
        operationGid: outcome.operationId,
        operation:
          outcome.operation === null
            ? null
            : {
                gid: outcome.operation.id,
                status: outcome.operation.status,
                total: outcome.operation.total,
                results: outcome.operation.results.edges.map(({node}) => ({shopGid: node.shopId, code: node.code})),
              },
        ...(outcome.status === 'failed' && 'userErrors' in outcome
          ? {
              error: {
                type: 'abort',
                message: outcome.userErrors.map(({message}) => message).join('; '),
                details: {userErrors: outcome.userErrors.map(({message, field}) => ({message, fieldPath: field}))},
              },
            }
          : {}),
      })),
    })
    expect(document).toBe(
      JSON.stringify(
        {
          status: 'partial',
          operations: result.outcomes.map((outcome) => ({
            status: outcome.status,
            operationGid: outcome.operationId,
            operation:
              outcome.operation === null
                ? null
                : {
                    gid: outcome.operation.id,
                    status: outcome.operation.status,
                    total: outcome.operation.total,
                    results: outcome.operation.results.edges.map(({node}) => ({shopGid: node.shopId, code: node.code})),
                  },
            ...(outcome.status === 'failed' && 'userErrors' in outcome
              ? {
                  error: {
                    type: 'abort',
                    message: outcome.userErrors.map(({message}) => message).join('; '),
                    details: {userErrors: outcome.userErrors.map(({message, field}) => ({message, fieldPath: field}))},
                  },
                }
              : {}),
          })),
        },
        null,
        2,
      ),
    )
  })
})

describe('migration submission JSON contract', () => {
  test('reports an empty successful submission as an unchanged object', () => {
    const value = {...submission(), total: 0, operations: []}
    expect(JSON.parse(encodeMigrationSubmissionResult({status: 'success', submission: value}))).toEqual({
      status: 'success',
      changed: false,
      ...value,
    })
  })

  test('rejects invalid public submission fields', () => {
    const valid = JSON.parse(encodeMigrationSubmissionResult({status: 'success', submission: submission()}))
    for (const fields of [
      {action: 'cancel'},
      {total: '1'},
      {total: -1},
      {unexpected: true},
      {operations: [{batchIndex: -1}]},
    ]) {
      expect(() => migrationSubmissionJsonOutputSchema.validate({...valid, ...fields})).toThrow()
    }
  })
})
