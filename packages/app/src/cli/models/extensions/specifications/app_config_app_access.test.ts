import spec from './app_config_app_access.js'
import {describe, expect, test} from 'vitest'

describe('app_config_app_access', () => {
  describe('transform', () => {
    test('should return the transformed object', () => {
      // Given
      const object = {
        access: {
          admin: {direct_api_mode: 'online'},
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
          admin: {direct_api_mode: 'online'},
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
          admin: {direct_api_mode: 'offline'},
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
          admin: {direct_api_mode: 'offline'},
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
