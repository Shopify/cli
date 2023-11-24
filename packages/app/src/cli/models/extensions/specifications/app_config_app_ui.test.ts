import spec from './app_config_app_ui.js'
import {describe, expect, test} from 'vitest'

describe('app_cofig_app_ui', () => {
  describe('validate', () => {
    test('a correct object should return ok', () => {
      // Given
      const object = {
        embedded: true,
        application_url: 'https://example.com',
        app_preferences: {
          url: 'https://example2.com',
        },
      }
      const appUiSpec = spec

      // When
      const result = appUiSpec.validate(object)

      // Then
      expect(() => result.valueOrBug()).not.toThrowError()
    })
    test.only('wrong application_url value should return ko', () => {
      // Given
      const object = {
        embedded: true,
        application_url: 'wrong_url',
        app_preferences: {
          url: 'https://example2.com',
        },
      }
      const appUiSpec = spec

      // When
      const result = appUiSpec.validate(object)

      // Then
      expect(() => result.valueOrBug()).toThrowError('application_url. Invalid url: wrong_url')
    })
    test('wrong app_preferences url value should return ko', () => {
      // Given
      const object = {
        embedded: true,
        application_url: 'https://example.com',
        app_preferences: {
          url: 'wrong_url',
        },
      }
      const appUiSpec = spec

      // When
      const result = appUiSpec.validate(object)

      // Then
      expect(() => result.valueOrBug()).toThrowError('app_preferences.url. Invalid url: wrong_url')
    })
  })

  describe('transform', () => {
    test('should return the transformed object', () => {
      // Given
      const object = {
        embedded: true,
        application_url: 'https://example.com',
        app_preferences: {
          url: 'https://example2.com',
        },
      }
      const appUiSpec = spec

      // When
      const result = appUiSpec.transform(object)

      // Then
      expect(result).toMatchObject({
        ui: 'embedded',
        app_url: 'https://example.com',
        preferences_url: 'https://example2.com',
      })
    })
  })

  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        ui: 'external',
        app_url: 'https://example.com',
        preferences_url: 'https://example2.com',
      }
      const appUiSpec = spec

      // When
      const result = appUiSpec.reverseTransform(object)

      // Then
      expect(result).toMatchObject({
        embedded: false,
        application_url: 'https://example.com',
        app_preferences: {
          url: 'https://example2.com',
        },
      })
    })
  })
})
