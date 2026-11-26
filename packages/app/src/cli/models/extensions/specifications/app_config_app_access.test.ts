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
    test('merges shop_scopes back into scopes', () => {
      // Given
      const object = {
        scopes: 'write_products,read_products',
        shop_scopes: 'shop_app:oauth,shop_app:read_profile',
        redirect_url_allowlist: ['https://example.com/auth/callback'],
      }

      // When
      const result = spec.transformRemoteToLocal!(object)

      // Then
      expect(result).toEqual({
        access_scopes: {
          scopes: 'read_products,shop_app:oauth,shop_app:read_profile,write_products',
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      })
    })

    test('uses shop_scopes as scopes when the platform scopes are empty or missing', () => {
      expect(spec.transformRemoteToLocal!({scopes: '', shop_scopes: 'shop_app:oauth'})).toEqual({
        access_scopes: {scopes: 'shop_app:oauth'},
      })
      expect(spec.transformRemoteToLocal!({shop_scopes: 'shop_app:oauth'})).toEqual({
        access_scopes: {scopes: 'shop_app:oauth'},
      })
    })

    test('leaves scopes untouched when shop_scopes is absent or blank', () => {
      expect(spec.transformRemoteToLocal!({scopes: 'read_products', shop_scopes: ''})).toEqual({
        access_scopes: {scopes: 'read_products'},
      })
      expect(spec.transformRemoteToLocal!({scopes: 'read_products'})).toEqual({
        access_scopes: {scopes: 'read_products'},
      })
    })

    test('round-trips: forward after reverse sends shop scopes in scopes', () => {
      const local = spec.transformRemoteToLocal!({scopes: 'read_products', shop_scopes: 'shop_app:oauth'})
      const remote = spec.transformLocalToRemote!(local, placeholderAppConfiguration)
      expect(remote).toEqual({scopes: 'read_products,shop_app:oauth'})
    })
  })

  describe('getDevSessionUpdateMessages', () => {
    test('should return message with scopes when scopes are provided', async () => {
      // Given
      const config = {
        access_scopes: {
          scopes: 'read_products,write_products',
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      }

      // When
      const result = await spec.getDevSessionUpdateMessages!(config, {status: 'created'})

      // Then
      expect(result).toEqual(['Access scopes auto-granted: read_products, write_products'])
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
      }

      // When
      const result = await spec.getDevSessionUpdateMessages!(config, {status: 'created'})

      // Then
      expect(result).toEqual(['Access scopes auto-granted: write_orders, read_inventory'])
    })

    test('should return managed install flow empty scopes message when no access_scopes are provided', async () => {
      // Given
      const config = {
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      }

      // When
      const result = await spec.getDevSessionUpdateMessages!(config, {status: 'created'})

      // Then
      expect(result).toEqual(['App has been installed'])
    })

    test('should return legacy install flow message when use_legacy_install_flow is true', async () => {
      // Given
      const config = {
        access_scopes: {
          scopes: 'read_products,write_products',
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      }

      // When
      const result = await spec.getDevSessionUpdateMessages!(config, {status: 'created'})

      // Then
      expect(result).toEqual(['Using legacy install flow - access scopes are not auto-granted'])
    })

    test('should return legacy install flow message even with required_scopes when use_legacy_install_flow is true', async () => {
      // Given
      const config = {
        access_scopes: {
          required_scopes: ['write_orders', 'read_inventory'],
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      }

      // When
      const result = await spec.getDevSessionUpdateMessages!(config, {status: 'created'})

      // Then
      expect(result).toEqual(['Using legacy install flow - access scopes are not auto-granted'])
    })

    test('should return normal scopes message when use_legacy_install_flow is false', async () => {
      // Given
      const config = {
        access_scopes: {
          scopes: 'read_products,write_products',
          use_legacy_install_flow: false,
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      }

      // When
      const result = await spec.getDevSessionUpdateMessages!(config, {status: 'created'})

      // Then
      expect(result).toEqual(['Access scopes auto-granted: read_products, write_products'])
    })

    test('should return legacy install flow message when both scopes and required_scopes are nil', async () => {
      // Given
      const config = {
        access_scopes: {},
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      }

      // When
      const result = await spec.getDevSessionUpdateMessages!(config, {status: 'created'})

      // Then
      expect(result).toEqual(['Using legacy install flow - access scopes are not auto-granted'])
    })

    test('should handle empty string scopes', async () => {
      // Given
      const config = {
        access_scopes: {
          scopes: '',
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      }

      // When
      const result = await spec.getDevSessionUpdateMessages!(config, {status: 'created'})

      // Then
      expect(result).toEqual(['App has been installed'])
    })

    test('should handle empty array required_scopes', async () => {
      // Given
      const config = {
        access_scopes: {
          required_scopes: [],
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      }

      // When
      const result = await spec.getDevSessionUpdateMessages!(config, {status: 'created'})

      // Then
      expect(result).toEqual(['App has been installed'])
    })
  })
})
