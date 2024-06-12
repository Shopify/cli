import spec from './app_config_app_home.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {describe, expect, test} from 'vitest'

describe('app_home', () => {
  describe('transform', () => {
    test('should return the transformed object', () => {
      // Given
      const object = {
        application_url: 'https://my-app-url.dev',
        embedded: true,
        app_preferences: {
          url: 'https://my-preferences-url.dev',
        },
      }

      const appConfigSpec = spec

      // When
      const result = appConfigSpec.transformLocalToRemote!(object, placeholderAppConfiguration)

      // Then
      expect(result).toMatchObject({
        app_url: 'https://my-app-url.dev',
        embedded: true,
        preferences_url: 'https://my-preferences-url.dev',
      })
    })
  })

  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        app_url: 'https://my-app-url.dev',
        embedded: true,
        preferences_url: 'https://my-preferences-url.dev',
      }
      const appConfigSpec = spec

      // When
      const result = appConfigSpec.transformRemoteToLocal!(object)

      // Then
      expect(result).toMatchObject({
        application_url: 'https://my-app-url.dev',
        embedded: true,
        app_preferences: {
          url: 'https://my-preferences-url.dev',
        },
      })
    })
  })
})
