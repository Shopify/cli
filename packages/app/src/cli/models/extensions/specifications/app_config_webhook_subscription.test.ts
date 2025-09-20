import spec from './app_config_webhook_subscription.js'
import {AppConfigurationWithoutPath} from '../../app/app.js'
import {describe, expect, test} from 'vitest'

describe('webhook_subscription', () => {
  describe('reverseTransform', () => {
    test('should ignore api version and compliance topics', () => {
      // Given
      const object = {
        api_version: '2024-01',
        sub_topic: 'type:metaobject_one',
        topic: 'metaobjects/create',
        uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
        compliance_topics: ['shop/redact'],
      }

      const webhookSpec = spec

      // When
      const result = webhookSpec.transformRemoteToLocal!(object)

      // Then
      expect(result).toMatchObject({
        webhooks: {
          subscriptions: [
            {
              sub_topic: 'type:metaobject_one',
              topics: ['metaobjects/create'],
              uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
            },
          ],
        },
      })
    })

    test('should preserve payload_query in reverse transform', () => {
      // Given
      const object = {
        api_version: '2024-01',
        topic: 'products/update',
        uri: 'https://example.com/webhooks',
        payload_query: 'query { product { id title } }',
      }

      const webhookSpec = spec

      // When
      const result = webhookSpec.transformRemoteToLocal!(object)

      // Then
      expect(result).toMatchObject({
        webhooks: {
          subscriptions: [
            {
              topics: ['products/update'],
              uri: 'https://example.com/webhooks',
              payload_query: 'query { product { id title } }',
            },
          ],
        },
      })
    })

    test('should handle complex payload_query in reverse transform', () => {
      // Given
      const object = {
        api_version: '2024-01',
        topic: 'orders/create',
        uri: 'https://example.com/webhooks',
        payload_query: `
          query getOrder($id: ID!) {
            order(id: $id) {
              id
              totalPrice
              lineItems(first: 10) {
                edges {
                  node {
                    id
                    quantity
                  }
                }
              }
            }
          }
        `,
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
              uri: 'https://example.com/webhooks',
              payload_query: object.payload_query,
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
        application_url: 'https://my-app-url.com/',
      } as unknown as AppConfigurationWithoutPath)

      expect(result).toEqual({
        uri: 'https://my-app-url.com/products',
        topics: ['products/create'],
      })
    })

    test('preserves payload_query in forward transform', () => {
      const object = {
        topics: ['products/update'],
        uri: 'https://example.com/webhooks',
        payload_query: 'query { product { id title vendor } }',
      }

      const webhookSpec = spec

      const result = webhookSpec.transformLocalToRemote!(object, {
        application_url: 'https://my-app-url.com/',
      } as unknown as AppConfigurationWithoutPath)

      expect(result).toEqual({
        uri: 'https://example.com/webhooks',
        topics: ['products/update'],
        payload_query: 'query { product { id title vendor } }',
      })
    })

    test('preserves payload_query with relative URI', () => {
      const object = {
        topics: ['orders/create'],
        uri: '/webhooks/orders',
        payload_query: `
          query {
            order {
              id
              name
              totalPrice
            }
          }
        `,
      }

      const webhookSpec = spec

      const result = webhookSpec.transformLocalToRemote!(object, {
        application_url: 'https://my-app-url.com/',
      } as unknown as AppConfigurationWithoutPath)

      expect(result).toEqual({
        uri: 'https://my-app-url.com/webhooks/orders',
        topics: ['orders/create'],
        payload_query: object.payload_query,
      })
    })

    test('handles all optional fields including payload_query', () => {
      const object = {
        topics: ['products/update'],
        uri: '/products/webhook',
        include_fields: ['id', 'title', 'vendor'],
        filter: 'vendor:acme',
        payload_query: 'query { product { id title vendor tags } }',
      }

      const webhookSpec = spec

      const result = webhookSpec.transformLocalToRemote!(object, {
        application_url: 'https://my-app-url.com/',
      } as unknown as AppConfigurationWithoutPath)

      expect(result).toEqual({
        uri: 'https://my-app-url.com/products/webhook',
        topics: ['products/update'],
        include_fields: ['id', 'title', 'vendor'],
        filter: 'vendor:acme',
        payload_query: 'query { product { id title vendor tags } }',
      })
    })
  })
})
