import spec from './app_config_privacy_compliance_webhooks.js'
import {isEmpty} from '@shopify/cli-kit/common/object'
import {describe, expect, test} from 'vitest'

describe('privacy_compliance_webhooks', () => {
  describe('transform', () => {
    test('should return the transformed object', () => {
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
    test('should return undefined if all porperties are empty', () => {
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

  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        customers_redact_url: 'https://customer-deletion-url.dev',
        customers_data_request_url: 'https://customer-data-request-url.dev',
        shop_redact_url: 'https://shop-deletion-url.dev',
      }
      const privacyComplianceSpec = spec

      // When
      const result = privacyComplianceSpec.reverseTransform!(object)

      // Then
      expect(result).toMatchObject({
        webhooks: {
          privacy_compliance: {
            customer_deletion_url: 'https://customer-deletion-url.dev',
            customer_data_request_url: 'https://customer-data-request-url.dev',
            shop_deletion_url: 'https://shop-deletion-url.dev',
          },
        },
      })
    })
    test('should return undefined if all properties are empty', () => {
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
    test('should return only the properties that are not empty', () => {
      // Given
      const object = {
        customers_redact_url: 'http://customer-deletion-url.dev',
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
            customer_deletion_url: 'http://customer-deletion-url.dev',
          },
        },
      })
    })
  })
})
