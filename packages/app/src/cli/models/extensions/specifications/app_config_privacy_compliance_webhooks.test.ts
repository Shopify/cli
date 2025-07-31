import spec from './app_config_privacy_compliance_webhooks.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {isEmpty} from '@shopify/cli-kit/common/object'
import {describe, expect, test} from 'vitest'

describe('privacy_compliance_webhooks', () => {
  describe('transform', () => {
    test('should return the transformed object from the old format', () => {
      // Given
      const object = {
        webhooks: {
          privacy_compliance: {
            customer_deletion_url: 'https://customer-deletion-url.dev',
            customer_data_request_url: 'https://customer-data-request-url.dev',
            shop_deletion_url: 'https://shop-deletion-url.dev',
          },
        },
      }
      const privacyComplianceSpec = spec

      // When
      const result = privacyComplianceSpec.transformLocalToRemote!(object, placeholderAppConfiguration)

      // Then
      expect(result).toMatchObject({
        customers_redact_url: 'https://customer-deletion-url.dev',
        customers_data_request_url: 'https://customer-data-request-url.dev',
        shop_redact_url: 'https://shop-deletion-url.dev',
      })
    })

    test('should return the transformed object from the new format', () => {
      // Given
      const object = {
        webhooks: {
          api_version: '2024-07',
          subscriptions: [
            {
              compliance_topics: ['customers/redact', 'customers/data_request'],
              uri: 'https://example.com/customers_webhooks',
            },
            {
              compliance_topics: ['shop/redact'],
              uri: 'https://example.com/shop_webhooks',
            },
          ],
        },
      }
      const privacyComplianceSpec = spec

      // When
      const result = privacyComplianceSpec.transformLocalToRemote!(object, placeholderAppConfiguration)

      // Then
      expect(result).toMatchObject({
        api_version: '2024-07',
        customers_redact_url: 'https://example.com/customers_webhooks',
        customers_data_request_url: 'https://example.com/customers_webhooks',
        shop_redact_url: 'https://example.com/shop_webhooks',
      })
    })

    test('should return an empty object if all properties are empty', () => {
      // Given
      const object = {
        webhooks: {
          api_version: '2021-01',
        },
        privacy_compliance: {
          customer_deletion_url: '',
          customer_data_request_url: undefined,
          shop_deletion_url: '',
        },
      }
      const privacyComplianceSpec = spec

      // When
      const result = privacyComplianceSpec.transformLocalToRemote!(object, placeholderAppConfiguration)

      // Then
      expect(isEmpty(result)).toBeTruthy()
    })

    test('should transform with relative URIs', () => {
      // Given
      const object = {
        webhooks: {
          api_version: '2024-07',
          subscriptions: [
            {
              compliance_topics: ['customers/redact', 'customers/data_request'],
              uri: '/customers_webhooks',
            },
            {
              compliance_topics: ['shop/redact'],
              uri: '/shop_webhooks',
            },
          ],
        },
      }
      const privacyComplianceSpec = spec
      const appConfiguration = {application_url: 'https://example.com/', scopes: '', extension_directories: undefined}

      // When
      const result = privacyComplianceSpec.transformLocalToRemote!(object, appConfiguration)

      // Then
      expect(result).toMatchObject({
        api_version: '2024-07',
        customers_redact_url: 'https://example.com/customers_webhooks',
        customers_data_request_url: 'https://example.com/customers_webhooks',
        shop_redact_url: 'https://example.com/shop_webhooks',
      })
    })
  })

  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        customers_redact_url: 'https://example.com/customer-deletion',
        customers_data_request_url: 'https://example.com/customer-data-request',
        shop_redact_url: 'https://example.com/shop-deletion',
      }
      const privacyComplianceSpec = spec

      // When
      const result = privacyComplianceSpec.transformRemoteToLocal!(object)

      // Then
      expect(result).toMatchObject({
        webhooks: {
          privacy_compliance: undefined,
        },
      })
    })

    test('should return only the properties that are not empty', () => {
      // Given
      const object = {
        customers_redact_url: 'https://example.com/customer-deletion',
        customers_data_request_url: '',
        shop_redact_url: undefined,
      }
      const privacyComplianceSpec = spec

      // When
      const result = privacyComplianceSpec.transformRemoteToLocal!(object)

      // Then
      expect(result).toEqual({
        webhooks: {
          privacy_compliance: undefined,
          subscriptions: [
            {
              compliance_topics: ['customers/redact'],
              uri: 'https://example.com/customer-deletion',
            },
          ],
        },
      })
    })

    test('should return an empty  if all properties are empty', () => {
      // Given
      const object = {
        customers_redact_url: '',
        customers_data_request_url: '',
        shop_redact_url: undefined,
      }
      const privacyComplianceSpec = spec

      // When
      const result = privacyComplianceSpec.transformRemoteToLocal!(object)

      // Then
      expect(isEmpty(result)).toBeTruthy()
    })
  })
})
