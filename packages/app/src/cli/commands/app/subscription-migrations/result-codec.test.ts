import {encodeMigrationCancellationResult, encodeMigrationSubmissionResult} from './result-codec.js'
import {describe, expect, test} from 'vitest'
import type {MigrationOperation} from '../../../models/subscription-migrations.js'
import type {MigrationCancellationResult} from '../../../services/subscription-migrations/cancel-operations.js'
import type {
  MigrationSubmission,
  MigrationSubmissionResult,
} from '../../../services/subscription-migrations/submit-migration-plan.js'

function operation(id: string): MigrationOperation {
  return {id, status: 'RUNNING', total: 1, results: {edges: []}}
}

function submission(): MigrationSubmission {
  return {
    clientId: 'client-id',
    action: 'schedule',
    rootIdempotencyKey: 'root-key',
    inputDigest: 'input-digest',
    total: 1,
    operations: [
      {
        batchIndex: 0,
        batchPayloadDigest: 'batch-digest',
        idempotencyKey: 'batch-key',
        operation: operation('operation-one'),
      },
    ],
  }
}

describe('subscription migration result codecs', () => {
  test('encodes a successful submission with the existing JSON shape', () => {
    const value = submission()
    const result: MigrationSubmissionResult = {status: 'success', submission: value}

    const document = encodeMigrationSubmissionResult(result)

    expect(JSON.parse(document)).toEqual({schemaVersion: 1, ...value})
    expect(document).toBe(JSON.stringify({schemaVersion: 1, ...value}, null, 2))
  })

  test('encodes accepted submission evidence and failure details in one JSON document', () => {
    const value = submission()
    const result: MigrationSubmissionResult = {
      status: 'failed',
      submission: value,
      failure: {
        type: 'submission',
        batchIndex: 1,
        userErrors: [{message: 'Rejected remaining shops', field: ['input']}],
      },
    }

    const document = encodeMigrationSubmissionResult(result)

    expect(JSON.parse(document)).toEqual({
      schemaVersion: 1,
      ...value,
      failure: {
        type: 'submission',
        batchIndex: 1,
        userErrors: [{message: 'Rejected remaining shops', field: ['input']}],
      },
    })
  })

  test('encodes terminal operation failure evidence in one JSON document', () => {
    const value = submission()
    value.operations[0]!.operation = {...value.operations[0]!.operation, status: 'FAILED'}
    const result: MigrationSubmissionResult = {
      status: 'failed',
      submission: value,
      failure: {type: 'operations', operationIds: ['operation-one']},
    }

    const document = encodeMigrationSubmissionResult(result)

    expect(JSON.parse(document)).toEqual({
      schemaVersion: 1,
      ...value,
      failure: {type: 'operations', operationIds: ['operation-one']},
    })
    expect(document).toBe(
      JSON.stringify(
        {
          schemaVersion: 1,
          ...value,
          failure: {type: 'operations', operationIds: ['operation-one']},
        },
        null,
        2,
      ),
    )
  })

  test('encodes every cancellation outcome in one JSON document', () => {
    const result: MigrationCancellationResult = {
      outcomes: [
        {status: 'success', operationId: 'one', operation: operation('one')},
        {
          status: 'failed',
          operationId: 'two',
          operation: operation('two'),
          userErrors: [{message: 'Already completed', field: ['id']}],
        },
        {
          status: 'failed',
          operationId: 'three',
          operation: null,
          userErrors: [{message: 'Operation not found', field: null}],
        },
      ],
    }

    const document = encodeMigrationCancellationResult(result)

    expect(JSON.parse(document)).toEqual({schemaVersion: 1, outcomes: result.outcomes})
    expect(document).toBe(JSON.stringify({schemaVersion: 1, outcomes: result.outcomes}, null, 2))
  })
})
