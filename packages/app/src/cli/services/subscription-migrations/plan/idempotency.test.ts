import {deriveBatchIdempotencyKey, generateRootIdempotencyKey} from './idempotency.js'
import {describe, expect, test} from 'vitest'
import type {MigrationAction} from '../../../models/subscription-migrations.js'

const baseInput = {
  appIdentifier: 'client-id',
  action: 'schedule' as MigrationAction,
  rootKey: 'root-key',
  canonicalBatchPayload: '{"version":1,"action":"schedule","rows":[]}',
}

describe('migration idempotency', () => {
  test('generates a UUID root key', () => {
    expect(generateRootIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  test('derives the same batch key for identical semantic inputs', () => {
    expect(deriveBatchIdempotencyKey(baseInput)).toBe(deriveBatchIdempotencyKey(baseInput))
  })

  test.each([
    ['app identifier', {appIdentifier: 'different-app'}],
    ['action', {action: 'unschedule' as MigrationAction}],
    ['root key', {rootKey: 'different-root'}],
    ['canonical payload', {canonicalBatchPayload: '{"different":true}'}],
  ])('changes the batch key when the %s changes', (_description, changedInput) => {
    expect(deriveBatchIdempotencyKey({...baseInput, ...changedInput})).not.toBe(deriveBatchIdempotencyKey(baseInput))
  })

  test('matches the committed v1 derivation vector', () => {
    expect(deriveBatchIdempotencyKey(baseInput)).toBe(
      '8dc97c009690495df812685c01546c6d0cb9ff504aca8cd98fc4fa50f56c359c',
    )
  })
})
