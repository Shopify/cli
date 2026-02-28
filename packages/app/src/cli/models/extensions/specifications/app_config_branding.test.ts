import spec from './app_config_branding.js'
import {describe, expect, test} from 'vitest'

describe('branding', () => {
  describe('transform', () => {
    test('transformLocalToRemote should be undefined', () => {
      expect(spec.transformLocalToRemote).toBeUndefined()
    })
  })

  describe('deployConfig', () => {
    test('should preserve both name and handle in deploy payload', async () => {
      const config = {
        type: 'branding',
        uid: 'branding',
        path: '/test',
        extensions: {},
        name: 'my-app',
        handle: 'my-app-handle',
      }
      const result = await spec.deployConfig!(config as any, '', '', undefined)
      expect(result).toEqual({name: 'my-app', handle: 'my-app-handle'})
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
      const result = appConfigSpec.transformRemoteToLocal!(object)

      // Then
      expect(result).toMatchObject({
        name: 'my-app',
        handle: 'my-app-handle',
      })
    })
  })
})
