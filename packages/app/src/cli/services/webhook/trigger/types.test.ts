import {appWebhookTriggerJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

const result = {
  status: 'success',
  delivery: {
    topic: 'orders/create',
    apiVersion: '2026-10',
    deliveryMethod: 'http',
    address: 'https://example.com/webhooks',
    status: 'enqueued',
  },
} as const

test('encodes a strict delivery result', () => {
  expect(JSON.parse(appWebhookTriggerJsonOutputSchema.encode(result))).toEqual(result)
})

test.each([
  {...result, status: 'failed'},
  {...result, clientSecret: 'private'},
  {...result, delivery: {...result.delivery, headers: {authorization: 'private'}}},
  {...result, delivery: {...result.delivery, status: 'received'}},
  {...result, delivery: {...result.delivery, deliveryMethod: 'unknown'}},
  {...result, delivery: {...result.delivery, apiVersion: null}},
])('rejects an invalid delivery result: %j', (input) => {
  expect(() => appWebhookTriggerJsonOutputSchema.validate(input)).toThrow()
})
