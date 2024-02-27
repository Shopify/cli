import spec from './app_config_app_proxy.js'
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
      const result = appConfigSpec.transform!(object)

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
      const result = appConfigSpec.reverseTransform!(object)

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
})
