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

    expect(JSON.parse(document)).toEqual(value)
    expect(document).toBe(JSON.stringify(value, null, 2))
    expect(document).not.toContain('idempotencyKey')
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
      ...value,
      failure: {type: 'operations', operationIds: ['operation-one']},
    })
    expect(document).toBe(
      JSON.stringify(
        {
          ...value,
          failure: {type: 'operations', operationIds: ['operation-one']},
        },
        null,
        2,
      ),
    )
  })

  test('rejects cancellation documents with an invalid outcome', () => {
    expect(() =>
      migrationCancellationJsonOutputSchema.validate({
        outcomes: [{status: 'success', operationId: 'one', operation: null}],
      }),
    ).toThrow()
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

    expect(JSON.parse(document)).toEqual({outcomes: result.outcomes})
    expect(document).toBe(JSON.stringify({outcomes: result.outcomes}, null, 2))
  })
})

describe('migration submission JSON contract', () => {
  test('preserves an empty successful submission without failure details', () => {
    const value = {...submission(), total: 0, operations: []}
    expect(encodeMigrationSubmissionResult({status: 'success', submission: value})).toBe(JSON.stringify(value, null, 2))
  })

  test('preserves total submission failure with nullable error fields', () => {
    const value = {...submission(), operations: []}
    const failure = {type: 'submission' as const, batchIndex: 0, userErrors: [{message: 'Rejected', field: null}]}
    expect(encodeMigrationSubmissionResult({status: 'failed', submission: value, failure})).toBe(
      JSON.stringify({...value, failure}, null, 2),
    )
  })

  test.each([
    {action: 'cancel'},
    {total: '1'},
    {failure: {type: 'operations'}},
    {failure: {type: 'submission', batchIndex: 0, userErrors: [{message: 'Rejected'}]}},
    {operations: [{batchIndex: 0, batchPayloadDigest: 'digest', operation: {...operation('one'), status: 'UNKNOWN'}}]},
  ])('rejects invalid submission fields: %j', (fields) => {
    expect(() => migrationSubmissionJsonOutputSchema.validate({...submission(), ...fields})).toThrow()
  })
})

describe('unschedule JSON compatibility', () => {
  test('uses the shared submission contract and preserves the unschedule action', () => {
    const value = {...submission(), action: 'unschedule' as const}
    const encoded = encodeMigrationSubmissionResult({status: 'success', submission: value})

    expect(encoded).toBe(JSON.stringify(value, null, 2))
    expect(migrationSubmissionJsonOutputSchema.validate(JSON.parse(encoded))).toEqual(value)
    expect(JSON.parse(encoded)).not.toHaveProperty('failure')
  })
})
