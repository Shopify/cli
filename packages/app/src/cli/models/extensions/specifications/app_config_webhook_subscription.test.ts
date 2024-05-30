import spec from './app_config_webhook_subscription.js'
import {CurrentAppConfiguration} from '../../app/app.js'
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
              api_version: '2024-01',
              topics: ['orders/create'],
              uri: 'https://example.com/webhooks/orders',
            },
            {
              api_version: '2024-01',
              topics: ['products/create'],
              uri: 'https://example.com/webhooks/products',
            },
            {
              api_version: '2024-01',
              filter: 'title:shoes',
              topics: ['products/update'],
              uri: 'https://example.com/webhooks/products',
            },
            {
              api_version: '2024-01',
              include_fields: ['variants', 'title'],
              topics: ['orders/create'],
              uri: 'https://valid-url',
            },
            {
              api_version: '2024-01',
              sub_topic: 'type:metaobject_one',
              topics: ['metaobjects/create'],
              uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
            },
          ],
        },
      })
    })
  })

  describe('forwardTransform', () => {
    test('when a relative URI is used, it inherits the application_url', () => {
      const object = {
        topics: ['products/create'],
        uri: '/products',
      }

      const webhookSpec = spec

      const result = webhookSpec.transformLocalToRemote!(object, {
        fullAppConfiguration: {application_url: 'https://my-app-url.com'} as CurrentAppConfiguration,
      })

      expect(result).toEqual({
        uri: 'https://my-app-url.com/products',
        topics: ['products/create'],
      })
    })
  })
})
