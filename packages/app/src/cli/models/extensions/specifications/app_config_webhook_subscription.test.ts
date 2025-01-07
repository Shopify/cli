import spec from './app_config_webhook_subscription.js'
import {WebhookSubscriptionSchema} from './app_config_webhook_schemas/webhook_subscription_schema.js'
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

    test('should preserve metafields during transformation', () => {
      // Given
      const object = {
        api_version: '2025-04',
        topic: 'orders/create',
        uri: 'https://example.com/webhooks',
        metafields: [
          {namespace: 'custom', key: 'test1'},
          {namespace: 'app', key: 'test2'},
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
              uri: 'https://example.com/webhooks',
              metafields: [
                {namespace: 'custom', key: 'test1'},
                {namespace: 'app', key: 'test2'},
              ],
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

    test('should preserve metafields during forward transformation', () => {
      const object = {
        topics: ['orders/create'],
        uri: 'https://example.com/webhooks',
        metafields: [
          {namespace: 'custom', key: 'test1'},
          {namespace: 'app', key: 'test2'},
        ],
      }

      const webhookSpec = spec

      const result = webhookSpec.transformLocalToRemote!(object, {
        application_url: 'https://my-app-url.com/',
      } as unknown as AppConfigurationWithoutPath)

      expect(result).toEqual({
        uri: 'https://example.com/webhooks',
        topics: ['orders/create'],
        metafields: [
          {namespace: 'custom', key: 'test1'},
          {namespace: 'app', key: 'test2'},
        ],
      })
    })
  })

  describe('metafields validation', () => {
    test('transforms metafields correctly in local to remote', () => {
      // Given
      const object = {
        topics: ['products/create'],
        uri: '/products',
        metafields: [
          {
            namespace: 'custom',
            key: 'test',
          },
        ],
      }

      const webhookSpec = spec

      // When
      const result = webhookSpec.transformLocalToRemote!(object, {
        application_url: 'https://my-app-url.com/',
      } as unknown as AppConfigurationWithoutPath)

      // Then
      expect(result).toEqual({
        uri: 'https://my-app-url.com/products',
        topics: ['products/create'],
        metafields: [
          {
            namespace: 'custom',
            key: 'test',
          },
        ],
      })
    })

    test('preserves metafields in remote to local transform', () => {
      // Given
      const object = {
        topic: 'products/create',
        uri: 'https://my-app-url.com/products',
        metafields: [
          {
            namespace: 'custom',
            key: 'test',
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
              topics: ['products/create'],
              uri: 'https://my-app-url.com/products',
              metafields: [
                {
                  namespace: 'custom',
                  key: 'test',
                },
              ],
            },
          ],
        },
      })
    })

    test('rejects metafields with invalid property types', () => {
      // Given
      const object = {
        topics: ['products/create'],
        uri: '/products',
        metafields: [
          {
            namespace: 123,
            key: 'valid',
          },
        ],
      }

      // When
      const result = WebhookSubscriptionSchema.safeParse(object)

      // Then
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Metafield namespace must be a string')
      }
    })

    test('rejects metafields with missing a required property', () => {
      // Given
      const object = {
        topics: ['products/create'],
        uri: '/products',
        metafields: [
          {
            namespace: 'custom',
          },
        ],
      }

      // When
      const result = WebhookSubscriptionSchema.safeParse(object)

      // Then
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/Required/)
      }
    })
  })
})
