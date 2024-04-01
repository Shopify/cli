import spec from './app_config_webhook.js'
import {SpecsAppConfiguration} from './types/app_config.js'
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
        api_version: '2024-01',
        subscriptions: [
          {
            topic: 'orders/delete',
            uri: 'https://example.com/webhooks/orders',
          },
          {
            topic: 'orders/create',
            uri: 'https://example.com/webhooks/orders',
          },
          {
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
  })
  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
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
          {
            sub_topic: 'type:metaobject_one',
            topic: 'metaobjects/create',
            uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
          },
          {
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
  })

  describe('simplify', () => {
    test('simplifies all webhooks, including privacy compliance webhooks, under the same [[webhook.subscription]] if they have the same fields', () => {
      // Given
      const remoteApp = {
        name: 'test-app',
        handle: 'test-app',
        access_scopes: {scopes: 'write_products'},
        auth: {
          redirect_urls: [
            'https://decided-tabs-chevrolet-stating.trycloudflare.com/auth/callback',
            'https://decided-tabs-chevrolet-stating.trycloudflare.com/auth/shopify/callback',
            'https://decided-tabs-chevrolet-stating.trycloudflare.com/api/auth/callback',
          ],
        },
        webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {
              topics: ['products/create'],
              uri: 'https://example.com/webhooks',
            },
            {
              compliance_topics: ['customers/redact'],
              uri: 'https://example.com/webhooks',
            },
            {
              compliance_topics: ['customers/data_request'],
              uri: 'https://example.com/webhooks',
            },
            {
              topics: ['metaobjects/create'],
              sub_topic: 'subtopic',
              uri: 'https://example.com/webhooks',
            },
          ],
          privacy_compliance: undefined,
        },
        pos: {embedded: false},
        application_url: 'https://decided-tabs-chevrolet-stating.trycloudflare.com',
        embedded: true,
      } as unknown as SpecsAppConfiguration
      const webhookSpec = spec
      // When
      const result = webhookSpec.simplify!(remoteApp)
      // Then
      expect(result).toMatchObject({
        name: 'test-app',
        handle: 'test-app',
        access_scopes: {scopes: 'write_products'},
        auth: {
          redirect_urls: [
            'https://decided-tabs-chevrolet-stating.trycloudflare.com/auth/callback',
            'https://decided-tabs-chevrolet-stating.trycloudflare.com/auth/shopify/callback',
            'https://decided-tabs-chevrolet-stating.trycloudflare.com/api/auth/callback',
          ],
        },
        webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {
              topics: ['products/create'],
              compliance_topics: ['customers/redact', 'customers/data_request'],
              uri: 'https://example.com/webhooks',
            },
            {
              topics: ['metaobjects/create'],
              sub_topic: 'subtopic',
              uri: 'https://example.com/webhooks',
            },
          ],
          privacy_compliance: undefined,
        },
        pos: {embedded: false},
        application_url: 'https://decided-tabs-chevrolet-stating.trycloudflare.com',
        embedded: true,
      })
    })
  })
})
