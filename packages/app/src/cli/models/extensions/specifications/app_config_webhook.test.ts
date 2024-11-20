import spec from './app_config_webhook.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {ClientName} from '../../../utilities/developer-platform-client.js'
import {describe, expect, test} from 'vitest'

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

  describe('customizeSchemaForDevPlatformClient', () => {
    test('when using Partners client, webhooks field becomes required', () => {
      const webhookSpec = spec
      const schema = webhookSpec.customizeSchemaForDevPlatformClient!(ClientName.Partners, webhookSpec.schema)

      expect(() => schema.parse({})).toThrow()
      expect(() => schema.parse({webhooks: {subscriptions: []}})).toThrow()
      expect(() => schema.parse({webhooks: {api_version: '2024-01', subscriptions: []}})).not.toThrow()
    })

    test('when using non-Partners client, webhooks field remains optional', () => {
      const webhookSpec = spec
      const schema = webhookSpec.customizeSchemaForDevPlatformClient!(ClientName.AppManagement, webhookSpec.schema)

      expect(() => schema.parse({})).not.toThrow()
      // if webhooks field is present, we still always need api_version
      expect(() => schema.parse({webhooks: {subscriptions: []}})).toThrow()
      expect(() => schema.parse({webhooks: {api_version: '2024-01', subscriptions: []}})).not.toThrow()
    })
  })
})
