import spec from './app_config_webhook_subscription.js'
import {describe, expect, test} from 'vitest'

describe('webhook_subscription', () => {
  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        api_version: '2024-01',
        subscriptions: [
          {
            api_version: '2024-01',
            topic: 'orders/create',
            uri: 'https://example.com/webhooks/orders',
          },
          {
            api_version: '2024-01',
            topic: 'products/create',
            uri: 'https://example.com/webhooks/products',
          },
          {
            api_version: '2024-01',
            sub_topic: 'type:metaobject_one',
            topic: 'metaobjects/create',
            uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
          },
          {
            api_version: '2024-01',
            include_fields: ['variants', 'title'],
            topic: 'orders/create',
            uri: 'https://valid-url',
          },
          {
            api_version: '2024-01',
            filter: 'title:shoes',
            topic: 'products/update',
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
          subscriptions: [
            {
              topics: ['orders/create'],
              uri: 'https://example.com/webhooks/orders',
            },
            {
              topics: ['products/create'],
              uri: 'https://example.com/webhooks/products',
            },
            {
              sub_topic: 'type:metaobject_one',
              topics: ['metaobjects/create'],
              uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
            },
            {
              include_fields: ['variants', 'title'],
              topics: ['orders/create'],
              uri: 'https://valid-url',
            },
            {
              filter: 'title:shoes',
              topics: ['products/update'],
              uri: 'https://example.com/webhooks/products',
            },
          ],
        },
      })
    })
  })
})
