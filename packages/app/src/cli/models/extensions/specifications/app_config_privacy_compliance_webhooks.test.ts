import spec from './app_config_privacy_compliance_webhooks.js'
import {describe, expect, test} from 'vitest'

describe('app_config_privacy_compliance_webhooks', () => {
  describe('transform', () => {
    test('should return the transformed object', () => {
      // Given
      const object = {
        webhooks: {
          privacy_compliance: {
            customer_deletion_url: 'https://myhooks.dev/apps/customer_deletion_url',
            customer_data_request_url: 'https://myhooks.dev/apps/customer_data_request_url',
            shop_deletion_url: 'https://myhooks.dev/apps/shop_deletion_url',
          },
        },
      }
      const appConfigSpec = spec

      // When
      const result = appConfigSpec.transform!(object)

      // Then
      expect(result).toMatchObject({
        customers_redact_url: 'https://myhooks.dev/apps/customer_deletion_url',
        customers_data_request_url: 'https://myhooks.dev/apps/customer_data_request_url',
        shop_redact_url: 'https://myhooks.dev/apps/shop_deletion_url',
      })
    })
  })

  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        customers_redact_url: 'https://myhooks.dev/apps/customer_deletion_url',
        customers_data_request_url: 'https://myhooks.dev/apps/customer_data_request_url',
        shop_redact_url: 'https://myhooks.dev/apps/shop_deletion_url',
      }
      const appConfigSpec = spec

      // When
      const result = appConfigSpec.reverseTransform!(object)

      // Then
      expect(result).toMatchObject({
        webhooks: {
          privacy_compliance: {
            customer_deletion_url: 'https://myhooks.dev/apps/customer_deletion_url',
            customer_data_request_url: 'https://myhooks.dev/apps/customer_data_request_url',
            shop_deletion_url: 'https://myhooks.dev/apps/shop_deletion_url',
          },
        },
      })
    })
  })
})
