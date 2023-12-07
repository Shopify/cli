import spec from './app_config_app_access.js'
import {describe, expect, test} from 'vitest'

describe('app_cofig_app_access', () => {
  describe('transform', () => {
    test('should return the transformed object', () => {
      // Given
      const object = {
        access_scopes: {
          scopes: 'scope',
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://redirect-1.com', 'https://redirect-2.com'],
        },
        access: {
          admin: {
            mode: 'online',
          },
          customer_account: true,
        },
      }
      const appAccessSpec = spec

      // When
      const result = appAccessSpec.transform!(object)

      // Then
      expect(result).toMatchObject({
        scopes: 'scope',
        use_legacy_install_flow: true,
        admin: {
          mode: 'online',
        },
        customer_account: true,
        redirect_urls: ['https://redirect-1.com', 'https://redirect-2.com'],
      })
    })
  })

  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        scopes: 'scope',
        use_legacy_install_flow: true,
        admin: {
          mode: 'online',
        },
        customer_account: true,
        redirect_urls: ['https://redirect-1.com', 'https://redirect-2.com'],
      }
      const appAccessSpec = spec

      // When
      const result = appAccessSpec.reverseTransform!(object)

      // Then
      expect(result).toMatchObject({
        access_scopes: {
          scopes: 'scope',
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://redirect-1.com', 'https://redirect-2.com'],
        },
        access: {
          admin: {
            mode: 'online',
          },
          customer_account: true,
        },
      })
    })
  })
})
