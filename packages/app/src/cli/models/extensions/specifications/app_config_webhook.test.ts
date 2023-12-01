import spec from './app_config_webhook.js'
import {describe, expect, test} from 'vitest'

describe('webhooks', () => {
  describe('transform', () => {
    test('should return the transformed object', () => {
      // Given
      const object = {
        endpoint: 'https://my-app.com/webhooks',
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
            subtopic: 'something',
            endpoint: 'pubsub://absolute-feat-test:pub-sub-topic2',
          },
          {
            topic: 'orders/create',
            include_fields: ['variants', 'title'],
            metafield_namespaces: ['size'],
            endpoint: 'https://valid-url',
          },
        ],
      }
      const webhookSpec = spec

      // When
      const result = webhookSpec.transform(object)

      // Then
      expect(result).toEqual([
        {
          topic: 'products/create',
          endpoint: 'https://my-app.com/webhooks',
        },
        {
          topic: 'products/update',
          endpoint: 'https://my-app.com/webhooks',
        },
        {
          topic: 'products/delete',
          endpoint: 'https://my-app.com/webhooks',
        },
        {
          endpoint: 'https://my-app.com/webhooks/my-neat-path',
          topic: 'orders/delete',
        },
        {
          endpoint: 'https://my-app.com/webhooks',
          topic: 'payment_terms.challenged',
        },
        {
          endpoint: 'pubsub://absolute-feat-test:pub-sub-topic2',
          topic: 'metaobjects/create',
          subtopic: 'something',
        },
        {
          endpoint: 'https://valid-url',
          topic: 'orders/create',
          include_fields: ['variants', 'title'],
          metafield_namespaces: ['size'],
        },
      ])
    })
  })
  describe('reverseTransform', () => {
    test.only('should return the reversed transformed object', () => {
      // Given
      const object = [
        {
          topic: 'products/create',
          endpoint: 'https://my-app.com/webhooks',
        },
        {
          topic: 'products/update',
          endpoint: 'https://my-app.com/webhooks',
        },
        {
          topic: 'products/delete',
          endpoint: 'https://my-app.com/webhooks',
        },
        {
          endpoint: 'https://my-app.com/webhooks/my-neat-path',
          topic: 'orders/delete',
        },
        {
          endpoint: 'pubsub://absolute-feat-test:pub-sub-topic2',
          topic: 'metaobjects/create',
          subtopic: 'something',
        },
        {
          endpoint: 'https://valid-url',
          topic: 'orders/create',
          include_fields: ['variants', 'title'],
          metafield_namespaces: ['size'],
        },
      ]
      const webhookSpec = spec

      // When
      const result = webhookSpec.reverseTransform(object)

      // Then
      // Then
      expect(result).toMatchObject({
        endpoint: 'https://my-app.com/webhooks',
        topics: ['products/create', 'products/update', 'products/delete'],
        subscriptions: [
          {
            topic: 'orders/delete',
            path: '/my-neat-path',
          },
          {
            topic: 'metaobjects/create',
            subtopic: 'something',
            endpoint: 'pubsub://absolute-feat-test:pub-sub-topic2',
          },
          {
            topic: 'orders/create',
            include_fields: ['variants', 'title'],
            metafield_namespaces: ['size'],
            endpoint: 'https://valid-url',
          },
        ],
      })
    })
  })
})
