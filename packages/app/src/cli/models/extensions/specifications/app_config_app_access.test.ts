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
      }
      const appAccessSpec = spec

      // When
      const result = appAccessSpec.transform!(object)

      // Then
      expect(result).toMatchObject({
        access: {
          direct_api_offline_access: true,
        },
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
      }
      const appAccessSpec = spec

      // When
      const result = appAccessSpec.reverseTransform!(object)

      // Then
      expect(result).toMatchObject({
        access: {
          direct_api_offline_access: true,
        },
      })
    })
  })
})
