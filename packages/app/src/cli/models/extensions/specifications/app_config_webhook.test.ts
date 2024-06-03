import spec from './app_config_webhook.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {describe, expect, test} from 'vitest'

describe('webhooks', () => {
  describe('transform', () => {
    test('even when there are subscriptions, only send api version', () => {
      // Given
      const object = {
        webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {
              topics: ['orders/create'],
              uri: 'https://example.com/webhooks/orders',
            },
            {
              topics: ['products/create'],
              uri: 'https://example.com/webhooks/products',
            },
          ],
        },
      }

      const webhookSpec = spec
      // When
      const result = webhookSpec.transformLocalToRemote!(object, placeholderAppConfiguration)

      // Then
      expect(result).toEqual({
        api_version: '2024-01',
      })
    })
  })
  describe('reverseTransform', () => {
    test('only returns api version even if there are subscriptions', () => {
      // Given
      const object = {
        api_version: '2024-01',
        subscriptions: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/webhooks/orders',
          },
          {
            topic: 'products/create',
            uri: 'https://example.com/webhooks/products',
          },
        ],
      }
      const webhookSpec = spec

      // When
      const result = webhookSpec.transformRemoteToLocal!(object)

      // Then
      expect(result).toMatchObject({
        webhooks: {
          api_version: '2024-01',
        },
      })
    })
  })
})
