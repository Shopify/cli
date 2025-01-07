import spec from './app_config_webhook.js'
import {webhookValidator} from './validation/app_config_webhook.js'
import {WebhookSubscriptionSchema} from './app_config_webhook_schemas/webhook_subscription_schema.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {describe, expect, test} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

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

  describe('validation', () => {
    interface TestWebhookConfig {
      api_version: string
      subscriptions: unknown[]
    }

    function validateWebhooks(webhookConfig: TestWebhookConfig) {
      const ctx = {
        addIssue: (issue: zod.ZodIssue) => {
          throw new Error(issue.message)
        },
        path: [],
      } as zod.RefinementCtx

      // First validate the schema for each subscription
      for (const subscription of webhookConfig.subscriptions) {
        const schemaResult = WebhookSubscriptionSchema.safeParse(subscription)
        if (!schemaResult.success) {
          return {
            success: false,
            error: new Error(schemaResult.error.issues[0]?.message ?? 'Invalid webhook subscription'),
          }
        }
      }

      // Then validate business rules
      try {
        webhookValidator(webhookConfig, ctx)
        return {success: true, error: undefined}
      } catch (error) {
        if (error instanceof Error) {
          return {success: false, error}
        }
        throw error
      }
    }

    test('allows metafields when API version is 2025-04', () => {
      // Given
      const webhookConfig: TestWebhookConfig = {
        api_version: '2025-04',
        subscriptions: [
          {
            topics: ['orders/create'],
            uri: 'https://example.com/webhooks',
            metafields: [{namespace: 'custom', key: 'test'}],
          },
        ],
      }

      // When
      const result = validateWebhooks(webhookConfig)

      // Then
      expect(result.success).toBe(true)
    })

    test('allows metafields when API version is unstable', () => {
      // Given
      const webhookConfig: TestWebhookConfig = {
        api_version: 'unstable',
        subscriptions: [
          {
            topics: ['orders/create'],
            uri: 'https://example.com/webhooks',
            metafields: [{namespace: 'custom', key: 'test'}],
          },
        ],
      }

      // When
      const result = validateWebhooks(webhookConfig)

      // Then
      expect(result.success).toBe(true)
    })

    test('rejects metafields when API version is earlier than 2025-04', () => {
      // Given
      const webhookConfig: TestWebhookConfig = {
        api_version: '2024-01',
        subscriptions: [
          {
            topics: ['orders/create'],
            uri: 'https://example.com/webhooks',
            metafields: [{namespace: 'custom', key: 'test'}],
          },
        ],
      }

      // When
      const result = validateWebhooks(webhookConfig)

      // Then
      expect(result.success).toBe(false)
      expect(result.error?.message).toBe(
        'Webhook metafields are only supported in API version 2025-04 or later, or with version "unstable"',
      )
    })

    test('validates metafields namespace and key are strings', () => {
      // Given
      const webhookConfig: TestWebhookConfig = {
        api_version: '2025-04',
        subscriptions: [
          {
            topics: ['orders/create'],
            uri: 'https://example.com/webhooks',
            metafields: [{namespace: 123, key: 'test'}],
          },
        ],
      }

      // When
      const result = validateWebhooks(webhookConfig)

      // Then
      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Metafield namespace must be a string')
    })

    test('allows configuration without metafields in older API versions', () => {
      // Given
      const webhookConfig: TestWebhookConfig = {
        api_version: '2024-01',
        subscriptions: [
          {
            topics: ['orders/create'],
            uri: 'https://example.com/webhooks',
          },
        ],
      }

      // When
      const result = validateWebhooks(webhookConfig)

      // Then
      expect(result.success).toBe(true)
    })

    test('allows empty metafields array in supported API versions', () => {
      // Given
      const webhookConfig: TestWebhookConfig = {
        api_version: '2025-04',
        subscriptions: [
          {
            topics: ['orders/create'],
            uri: 'https://example.com/webhooks',
            metafields: [],
          },
        ],
      }

      // When
      const result = validateWebhooks(webhookConfig)

      // Then
      expect(result.success).toBe(true)
    })

    test('rejects metafields with invalid property types', () => {
      // Given
      const webhookConfig: TestWebhookConfig = {
        api_version: '2025-04',
        subscriptions: [
          {
            topics: ['orders/create'],
            uri: 'https://example.com/webhooks',
            metafields: [
              {
                namespace: 123,
                key: 'valid',
              },
            ],
          },
        ],
      }

      // When
      const result = validateWebhooks(webhookConfig)

      // Then
      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Metafield namespace must be a string')
    })

    test('rejects malformed metafields missing a required property', () => {
      // Given
      const webhookConfig: TestWebhookConfig = {
        api_version: '2025-04',
        subscriptions: [
          {
            topics: ['orders/create'],
            uri: 'https://example.com/webhooks',
            metafields: [
              {
                namespace: 'custom',
              },
            ],
          },
        ],
      }

      // When
      const result = validateWebhooks(webhookConfig)

      // Then
      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Required')
    })
  })
})
