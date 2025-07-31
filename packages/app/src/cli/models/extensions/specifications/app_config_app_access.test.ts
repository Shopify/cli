import spec from './app_config_app_access.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
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
          optional_scopes: ['read_customers'],
          required_scopes: ['write_orders', 'read_inventory'],
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      }
      const appAccessSpec = spec

      // When
      const result = appAccessSpec.transformLocalToRemote!(object, placeholderAppConfiguration)

      // Then
      expect(result).toMatchObject({
        access: {
          admin: {direct_api_mode: 'online'},
        },
        scopes: 'read_products,write_products',
        optional_scopes: ['read_customers'],
        required_scopes: ['write_orders', 'read_inventory'],
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
        optional_scopes: ['read_customers'],
        required_scopes: ['write_orders', 'read_inventory'],
        use_legacy_install_flow: true,
        redirect_url_allowlist: ['https://example.com/auth/callback'],
      }
      const appAccessSpec = spec

      // When
      const result = appAccessSpec.transformRemoteToLocal!(object)

      // Then
      expect(result).toMatchObject({
        access: {
          admin: {direct_api_mode: 'offline'},
        },
        access_scopes: {
          scopes: 'read_products,write_products',
          optional_scopes: ['read_customers'],
          required_scopes: ['write_orders', 'read_inventory'],
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      })
    })
  })

  describe('getDevSessionUpdateMessage', () => {
    test('should return message with scopes when scopes are provided', async () => {
      // Given
      const config = {
        access_scopes: {
          scopes: 'read_products,write_products',
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      } as Parameters<NonNullable<typeof spec.getDevSessionUpdateMessage>>[0]

      // When
      const result = await spec.getDevSessionUpdateMessage!(config)

      // Then
      expect(result).toBe('Access scopes auto-granted: read_products, write_products')
    })

    test('should return message with required_scopes when only required_scopes are provided', async () => {
      // Given
      const config = {
        access_scopes: {
          required_scopes: ['write_orders', 'read_inventory'],
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      } as Parameters<NonNullable<typeof spec.getDevSessionUpdateMessage>>[0]

      // When
      const result = await spec.getDevSessionUpdateMessage!(config)

      // Then
      expect(result).toBe('Access scopes auto-granted: write_orders, read_inventory')
    })

    test('should return default message when no scopes are provided', async () => {
      // Given
      const config = {
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      } as Parameters<NonNullable<typeof spec.getDevSessionUpdateMessage>>[0]

      // When
      const result = await spec.getDevSessionUpdateMessage!(config)

      // Then
      expect(result).toBe('App has been installed')
    })
  })
})
