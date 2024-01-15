import spec from './app_config_app_access.js'
import {describe, expect, test} from 'vitest'

describe('app_cofig_app_access', () => {
  describe('transform', () => {
    test('should return the transformed object', () => {
      // Given
      const object = {
        access: {
          direct_api_offline_access: true,
        },
        access_scopes: {
          scopes: 'read_products,write_products',
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      }
      const appAccessSpec = spec

      // When
      const result = appAccessSpec.transform!(object)

      // Then
      expect(result).toMatchObject({
        access: {
          direct_api_offline_access: true,
        },
        scopes: 'read_products,write_products',
        use_legacy_install_flow: true,
        redirect_url_allowlist: ['https://example.com/auth/callback'],
      })
    })
  })

  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        access: {
          direct_api_offline_access: true,
        },
        scopes: 'read_products,write_products',
        use_legacy_install_flow: true,
        redirect_url_allowlist: ['https://example.com/auth/callback'],
      }
      const appAccessSpec = spec

      // When
      const result = appAccessSpec.reverseTransform!(object)

      // Then
      expect(result).toMatchObject({
        access: {
          direct_api_offline_access: true,
        },
        access_scopes: {
          scopes: 'read_products,write_products',
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      })
    })
  })
})
