import spec, {type AppProxyConfigType} from './app_config_app_proxy.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {describe, expect, test} from 'vitest'

describe('app_config_app_proxy', () => {
  describe('transform', () => {
    test('should return the transformed object', () => {
      // Given
      const object = {
        app_proxy: {
          url: 'https://my-proxy-new.dev',
          subpath: 'subpath-whatever',
          prefix: 'apps',
        },
      }
      const appConfigSpec = spec

      // When
      const result = appConfigSpec.transformLocalToRemote!(object, placeholderAppConfiguration)

      // Then
      expect(result).toMatchObject({
        url: 'https://my-proxy-new.dev',
        subpath: 'subpath-whatever',
        prefix: 'apps',
      })
    })
  })

  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        url: 'https://my-proxy-new.dev',
        subpath: 'subpath-whatever',
        prefix: 'apps',
      }
      const appConfigSpec = spec

      // When
      const result = appConfigSpec.transformRemoteToLocal!(object)

      // Then
      expect(result).toMatchObject({
        app_proxy: {
          url: 'https://my-proxy-new.dev',
          subpath: 'subpath-whatever',
          prefix: 'apps',
        },
      })
    })
  })

  describe('getDevSessionUpdateMessages', () => {
    test('should return both messages when app_proxy config is present', async () => {
      // Given
      const config: AppProxyConfigType = {
        app_proxy: {
          url: 'https://my-proxy.dev',
          subpath: 'apps',
          prefix: 'proxy',
        },
      }

      // When
      const result = await spec.getDevSessionUpdateMessages!(config)

      // Then
      expect(result).toEqual([
        'Using URL: https://my-proxy.dev',
        'Any changes to prefix and subpath will only apply to new installs',
      ])
    })

    test('should return empty array when no app_proxy config is present', async () => {
      // Given
      const config: AppProxyConfigType = {}

      // When
      const result = await spec.getDevSessionUpdateMessages!(config)

      // Then
      expect(result).toEqual([])
    })
  })
})
