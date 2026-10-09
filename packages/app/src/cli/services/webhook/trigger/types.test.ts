import {appWebhookTriggerJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

test('rejects extra fields and unknown delivery methods', () => {
  const delivery = {
    topic: 'orders/create',
    apiVersion: '2026-10',
    deliveryMethod: 'http',
    address: 'https://example.com/webhooks',
    status: 'enqueued',
  }
  expect(() => appWebhookTriggerJsonOutputSchema.validate({status: 'success', delivery, secret: 'private'})).toThrow()
  expect(() =>
    appWebhookTriggerJsonOutputSchema.validate({status: 'success', delivery: {...delivery, secret: 'private'}}),
  ).toThrow()
  expect(() =>
    appWebhookTriggerJsonOutputSchema.validate({status: 'success', delivery: {...delivery, deliveryMethod: 'unknown'}}),
  ).toThrow()
})
