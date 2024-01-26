import spec from './app_config_branding.js'
import {describe, expect, test} from 'vitest'

describe('branding', () => {
  describe('transform', () => {
    test('should return the transformed object', () => {
      // Given
      const object = {
        name: 'my-app',
        handle: 'my-app-handle',
      }
      const appConfigSpec = spec

      // When
      const result = appConfigSpec.transform!(object)

      // Then
      expect(result).toMatchObject({
        name: 'my-app',
        app_handle: 'my-app-handle',
      })
    })
  })

  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        name: 'my-app',
        app_handle: 'my-app-handle',
      }
      const appConfigSpec = spec

      // When
      const result = appConfigSpec.reverseTransform!(object)

      // Then
      expect(result).toMatchObject({
        name: 'my-app',
        handle: 'my-app-handle',
      })
    })
  })
})
