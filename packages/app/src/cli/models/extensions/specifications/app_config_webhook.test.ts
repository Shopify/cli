import spec from './app_config_webhook.js'
import {describe, expect, test} from 'vitest'

describe('webhooks', () => {
  describe('transform', () => {
    test('should return the transformed object', () => {
      // Given
      const object = {
        webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {
              uri: 'https://example.com/webhooks/orders',
              topics: ['orders/delete', 'orders/create', 'orders/edited'],
              metafield_namespaces: ['id', 'size'],
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
              metafield_namespaces: ['size'],
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
        api_version: '2024-01',
        subscriptions: [
          {
            metafield_namespaces: ['id', 'size'],
            topic: 'orders/delete',
            uri: 'https://example.com/webhooks/orders',
          },
          {
            metafield_namespaces: ['id', 'size'],
            topic: 'orders/create',
            uri: 'https://example.com/webhooks/orders',
          },
          {
            metafield_namespaces: ['id', 'size'],
            topic: 'orders/edited',
            uri: 'https://example.com/webhooks/orders',
          },
          {
            topic: 'products/create',
            uri: 'https://example.com/webhooks/products',
          },
          {
            sub_topic: 'type:metaobject_one',
            topic: 'metaobjects/create',
            uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
          },
          {
            sub_topic: 'type:metaobject_one',
            topic: 'metaobjects/update',
            uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
          },
          {
            sub_topic: 'type:metaobject_two',
            topic: 'metaobjects/create',
            uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
          },
          {
            sub_topic: 'type:metaobject_two',
            topic: 'metaobjects/update',
            uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
          },
          {
            include_fields: ['variants', 'title'],
            metafield_namespaces: ['size'],
            topic: 'orders/create',
            uri: 'https://valid-url',
          },
          {
            sub_topic: 'type:metaobject_one',
            topic: 'metaobjects/create',
            uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/1234567890/SOME_PATH',
          },
          {
            sub_topic: 'type:metaobject_one',
            topic: 'metaobjects/delete',
            uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/1234567890/SOME_PATH',
          },
        ],
      })
    })
    test('when there is no subscriptions only api version is sent', () => {
      // Given
      const object = {
        webhooks: {
          api_version: '2021-01',
        },
      }
      const webhookSpec = spec

      // When
      const result = webhookSpec.transform!(object)

      // Then
      expect(result).toEqual({
        api_version: '2021-01',
      })
    })
    test('when a relative URI is used, it inherits the application_url', () => {
      // Given
      const object = {
        webhooks: {
          api_version: '2021-01',
          subscriptions: [
            {
              topics: ['products/update', 'products/delete'],
              uri: '/products',
            },
          ],
        },
      }
      const webhookSpec = spec

      // When
      const result = webhookSpec.transform!(object, {application_url: 'https://my-app-url.com'})

      // Then
      expect(result).toEqual({
        api_version: '2021-01',
        subscriptions: [
          {
            topic: 'products/update',
            uri: 'https://my-app-url.com/products',
          },
          {
            topic: 'products/delete',
            uri: 'https://my-app-url.com/products',
          },
        ],
      })
    })
  })
  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        api_version: '2024-01',
        subscriptions: [
          {
            metafield_namespaces: ['id', 'size'],
            topic: 'orders/delete',
            uri: 'https://example.com/webhooks/orders',
          },
          {
            metafield_namespaces: ['id', 'size'],
            topic: 'orders/create',
            uri: 'https://example.com/webhooks/orders',
          },
          {
            metafield_namespaces: ['id', 'size'],
            topic: 'orders/edited',
            uri: 'https://example.com/webhooks/orders',
          },
          {
            topic: 'products/create',
            uri: 'https://example.com/webhooks/products',
          },
          {
            sub_topic: 'type:metaobject_one',
            topic: 'metaobjects/create',
            uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
          },
          {
            sub_topic: 'type:metaobject_two',
            topic: 'metaobjects/create',
            uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
          },
          {
            sub_topic: 'type:metaobject_one',
            topic: 'metaobjects/update',
            uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
          },
          {
            include_fields: ['variants', 'title'],
            metafield_namespaces: ['size'],
            topic: 'orders/create',
            uri: 'https://valid-url',
          },
          {
            sub_topic: 'type:metaobject_one',
            topic: 'metaobjects/create',
            uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/1234567890/SOME_PATH',
          },
          {
            sub_topic: 'type:metaobject_one',
            topic: 'metaobjects/delete',
            uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/1234567890/SOME_PATH',
          },
        ],
      }
      const webhookSpec = spec

      // When
      const result = webhookSpec.reverseTransform!(object)

      // Then
      expect(result).toMatchObject({
        webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {
              metafield_namespaces: ['id', 'size'],
              topics: ['orders/delete', 'orders/create', 'orders/edited'],
              uri: 'https://example.com/webhooks/orders',
            },
            {
              topics: ['products/create'],
              uri: 'https://example.com/webhooks/products',
            },
            {
              sub_topic: 'type:metaobject_one',
              topics: ['metaobjects/create', 'metaobjects/update'],
              uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
            },
            {
              sub_topic: 'type:metaobject_two',
              topics: ['metaobjects/create'],
              uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
            },
            {
              include_fields: ['variants', 'title'],
              metafield_namespaces: ['size'],
              topics: ['orders/create'],
              uri: 'https://valid-url',
            },
            {
              sub_topic: 'type:metaobject_one',
              topics: ['metaobjects/create', 'metaobjects/delete'],
              uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/1234567890/SOME_PATH',
            },
          ],
        },
      })
    })
    test('when no subscriptions are received only api version is returned', () => {
      // Given
      const object = {
        api_version: '2021-01',
      }
      const webhookSpec = spec

      // When
      const result = webhookSpec.reverseTransform!(object)

      // Then
      expect(result).toMatchObject({
        webhooks: {
          api_version: '2021-01',
        },
      })
    })
    test('when subscriptions share the application_url base, simplify with a relative path', () => {
      // Given
      const object = {
        api_version: '2021-01',
        subscriptions: [
          {
            topic: 'products/update',
            uri: 'https://my-app-url.com/products',
          },
          {
            topic: 'products/delete',
            uri: 'https://my-app-url.com/products',
          },
          {
            topic: 'orders/update',
            uri: 'https://my-app-url.com/orders',
          },
          {
            topic: 'customers/create',
            uri: 'https://customers-url.com',
          },
          {
            topic: 'customers/delete',
            uri: 'pubsub://absolute-feat-test:pub-sub-topic',
          },
        ],
      }
      const webhookSpec = spec

      // When
      const result = webhookSpec.reverseTransform!(object, {application_url: 'https://my-app-url.com'})

      // Then
      expect(result).toMatchObject({
        webhooks: {
          api_version: '2021-01',
          subscriptions: [
            {
              topics: ['products/update', 'products/delete'],
              uri: '/products',
            },
            {
              topics: ['orders/update'],
              uri: '/orders',
            },
            {
              topics: ['customers/create'],
              uri: 'https://customers-url.com',
            },
            {
              topics: ['customers/delete'],
              uri: 'pubsub://absolute-feat-test:pub-sub-topic',
            },
          ],
        },
      })
    })
  })
})
