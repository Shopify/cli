import {deriveBatchIdempotencyKey, generateInvocationId} from './idempotency.js'
import {describe, expect, test} from 'vitest'
import type {MigrationAction} from '../../../models/subscription-migrations.js'

const baseInput = {
  appIdentifier: 'client-id',
  action: 'schedule' as MigrationAction,
  invocationId: 'invocation-id',
  canonicalBatchPayload: '{"version":1,"action":"schedule","rows":[]}',
}

describe('migration request deduplication', () => {
  test('generates a UUID invocation ID', () => {
    expect(generateInvocationId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  test('derives the same batch key for identical internal inputs', () => {
    expect(deriveBatchIdempotencyKey(baseInput)).toBe(deriveBatchIdempotencyKey(baseInput))
  })

  test.each([
    ['app identifier', {appIdentifier: 'different-app'}],
    ['action', {action: 'unschedule' as MigrationAction}],
    ['invocation ID', {invocationId: 'different-invocation'}],
    ['canonical payload', {canonicalBatchPayload: '{"different":true}'}],
  ])('changes the batch key when the %s changes', (_description, changedInput) => {
    expect(deriveBatchIdempotencyKey({...baseInput, ...changedInput})).not.toBe(deriveBatchIdempotencyKey(baseInput))
  })

  test('matches the committed v1 derivation vector', () => {
    expect(deriveBatchIdempotencyKey(baseInput)).toBe(
      'ee07933a61f406a2657ecd1d87798b4b5c5e1159832eec581ea3311e824a8a82',
    )
  })
})
