import spec from './app_config_webhook.js'
import {describe, expect, test} from 'vitest'

describe('webhooks', () => {
  describe('transform', () => {
    test('should return the transformed object', () => {
      // Given
      const object = {
        webhooks: {
          uri: 'https://my-app.com/webhooks',
          topics: ['products/create', 'products/update', 'products/delete'],
          subscriptions: [
            {
              topic: 'orders/delete',
              path: '/my-neat-path',
            },
            {
              topic: 'payment_terms.challenged',
            },
            {
              topic: 'metaobjects/create',
              sub_topic: 'something',
              uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
            },
            {
              topic: 'orders/create',
              include_fields: ['variants', 'title'],
              metafield_namespaces: ['size'],
              uri: 'https://valid-url',
            },
          ],
        },
      }
      const webhookSpec = spec

      // When
      const result = webhookSpec.transform!(object)

      // Then
      expect(result).toEqual({
        subscriptions: [
          {
            topic: 'products/create',
            uri: 'https://my-app.com/webhooks',
          },
          {
            topic: 'products/update',
            uri: 'https://my-app.com/webhooks',
          },
          {
            topic: 'products/delete',
            uri: 'https://my-app.com/webhooks',
          },
          {
            uri: 'https://my-app.com/webhooks/my-neat-path',
            topic: 'orders/delete',
          },
          {
            uri: 'https://my-app.com/webhooks',
            topic: 'payment_terms.challenged',
          },
          {
            uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
            topic: 'metaobjects/create',
            sub_topic: 'something',
          },
          {
            uri: 'https://valid-url',
            topic: 'orders/create',
            include_fields: ['variants', 'title'],
            metafield_namespaces: ['size'],
          },
        ],
      })
    })
  })
  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        subscriptions: [
          {
            topic: 'products/create',
            uri: 'https://my-app.com/webhooks',
          },
          {
            topic: 'products/update',
            uri: 'https://my-app.com/webhooks',
          },
          {
            topic: 'products/delete',
            uri: 'https://my-app.com/webhooks',
          },
          {
            uri: 'https://my-app.com/webhooks/my-neat-path',
            topic: 'orders/delete',
          },
          {
            uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
            topic: 'metaobjects/create',
            sub_topic: 'something',
          },
          {
            uri: 'https://valid-url',
            topic: 'orders/create',
            include_fields: ['variants', 'title'],
            metafield_namespaces: ['size'],
          },
        ],
      }
      const webhookSpec = spec

      // When
      const result = webhookSpec.reverseTransform!(object)

      // Then
      expect(result).toMatchObject({
        webhooks: {
          uri: 'https://my-app.com/webhooks',
          topics: ['products/create', 'products/update', 'products/delete'],
          subscriptions: [
            {
              topic: 'orders/delete',
              path: '/my-neat-path',
            },
            {
              topic: 'metaobjects/create',
              sub_topic: 'something',
              uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
            },
            {
              topic: 'orders/create',
              include_fields: ['variants', 'title'],
              metafield_namespaces: ['size'],
              uri: 'https://valid-url',
            },
          ],
        },
      })
    })
  })
})
