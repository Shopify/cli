import spec from './app_config_privacy_compliance_webhooks.js'
import {Flag} from '../../../services/dev/fetch.js'
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
      const result = privacyComplianceSpec.transform!(object)

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
      const result = privacyComplianceSpec.transform!(object)

      // Then
      expect(result).toMatchObject({
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
      const result = privacyComplianceSpec.transform!(object)

      // Then
      expect(isEmpty(result)).toBeTruthy()
    })
  })

  describe('reverseTransform with declarative_webhooks flag', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        customers_redact_url: 'https://example.com/customer-deletion',
        customers_data_request_url: 'https://example.com/customer-data-request',
        shop_redact_url: 'https://example.com/shop-deletion',
      }
      const privacyComplianceSpec = spec

      // When
      const result = privacyComplianceSpec.reverseTransform!(object, {flags: [Flag.DeclarativeWebhooks]})

      // Then
      expect(result).toMatchObject({
        webhooks: {
          subscriptions: [
            {
              compliance_topics: ['customers/redact'],
              uri: 'https://example.com/customer-deletion',
            },
            {
              compliance_topics: ['customers/data_request'],
              uri: 'https://example.com/customer-data-request',
            },
            {
              compliance_topics: ['shop/redact'],
              uri: 'https://example.com/shop-deletion',
            },
          ],
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
      const result = privacyComplianceSpec.reverseTransform!(object, {flags: [Flag.DeclarativeWebhooks]})

      // Then
      expect(result).toEqual({
        webhooks: {
          subscriptions: [
            {
              compliance_topics: ['customers/redact'],
              uri: 'https://example.com/customer-deletion',
            },
          ],
        },
      })
    })

    test('should return an empty object if all properties are empty', () => {
      // Given
      const object = {
        customers_redact_url: '',
        customers_data_request_url: '',
        shop_redact_url: undefined,
      }
      const privacyComplianceSpec = spec

      // When
      const result = privacyComplianceSpec.reverseTransform!(object, {flags: [Flag.DeclarativeWebhooks]})

      // Then
      expect(isEmpty(result)).toBeTruthy()
    })
  })

  describe('reverseTransform without declarative_webhooks flag', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        customers_redact_url: 'https://example.com/customer-deletion',
        customers_data_request_url: 'https://example.com/customer-data-request',
        shop_redact_url: 'https://example.com/shop-deletion',
      }
      const privacyComplianceSpec = spec

      // When
      const result = privacyComplianceSpec.reverseTransform!(object)

      // Then
      expect(result).toMatchObject({
        webhooks: {
          privacy_compliance: {
            customer_data_request_url: 'https://example.com/customer-data-request',
            customer_deletion_url: 'https://example.com/customer-deletion',
            shop_deletion_url: 'https://example.com/shop-deletion',
          },
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
      const result = privacyComplianceSpec.reverseTransform!(object)

      // Then
      expect(result).toEqual({
        webhooks: {
          privacy_compliance: {
            customer_deletion_url: 'https://example.com/customer-deletion',
          },
        },
      })
    })

    test('should return an empty object if all properties are empty', () => {
      // Given
      const object = {
        customers_redact_url: '',
        customers_data_request_url: '',
        shop_redact_url: undefined,
      }
      const privacyComplianceSpec = spec

      // When
      const result = privacyComplianceSpec.reverseTransform!(object)

      // Then
      expect(isEmpty(result)).toBeTruthy()
    })
  })
})
