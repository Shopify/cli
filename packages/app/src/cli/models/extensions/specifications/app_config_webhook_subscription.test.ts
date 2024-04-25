import spec from './app_config_webhook_subscription.js'
import {describe, expect, test} from 'vitest'

describe('webhook_subscription', () => {
  describe('transform', () => {
    test('should return array of subscription objects from the TOML', () => {
      // Given
      const object = {
        webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {
              uri: 'https://example.com/webhooks/orders',
              topics: ['orders/delete', 'orders/create', 'orders/edited'],
            },
            {
              topics: ['products/create'],
              uri: 'https://example.com/webhooks/products',
            },
            {
              uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
              sub_topic: 'type:metaobject_one',
              topics: ['metaobjects/create', 'metaobjects/update'],
            },
            {
              topics: ['metaobjects/create', 'metaobjects/update'],
              uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
              sub_topic: 'type:metaobject_two',
            },
            {
              topics: ['orders/create'],
              uri: 'https://valid-url',
              include_fields: ['variants', 'title'],
            },
            {
              topics: ['metaobjects/create', 'metaobjects/delete'],
              uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/1234567890/SOME_PATH',
              sub_topic: 'type:metaobject_one',
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
            api_version: '2024-01',
            topic: 'orders/delete',
            uri: 'https://example.com/webhooks/orders',
          },
          {
            api_version: '2024-01',
            topic: 'orders/create',
            uri: 'https://example.com/webhooks/orders',
          },
          {
            api_version: '2024-01',
            topic: 'orders/edited',
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
            sub_topic: 'type:metaobject_one',
            topic: 'metaobjects/update',
            uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
          },
          {
            api_version: '2024-01',
            sub_topic: 'type:metaobject_two',
            topic: 'metaobjects/create',
            uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
          },
          {
            api_version: '2024-01',
            sub_topic: 'type:metaobject_two',
            topic: 'metaobjects/update',
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
            sub_topic: 'type:metaobject_one',
            topic: 'metaobjects/create',
            uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/1234567890/SOME_PATH',
          },
          {
            api_version: '2024-01',
            sub_topic: 'type:metaobject_one',
            topic: 'metaobjects/delete',
            uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/1234567890/SOME_PATH',
          },
        ],
      })
    })

    test('should return an empty object if there are no subscriptions in the TOML', () => {
      // Given
      const object = {
        webhooks: {
          api_version: '2024-01',
          subscriptions: [],
        },
      }
      const webhookSpec = spec

      // When
      const result = webhookSpec.transform!(object)

      // Then
      expect(result).toEqual({})
    })
  })

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
        ],
      }
      const webhookSpec = spec

      // When
      const result = webhookSpec.reverseTransform!(object)

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
          ],
        },
      })
    })
  })
})
