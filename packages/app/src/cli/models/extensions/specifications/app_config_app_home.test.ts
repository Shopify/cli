import spec from './app_config_app_home.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {ClientName} from '../../../utilities/developer-platform-client.js'
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

  describe('customizeSchemaForDevPlatformClient', () => {
    test('when using Partners client, application_url and embedded fields become required', () => {
      const appConfigSpec = spec
      const schema = appConfigSpec.customizeSchemaForDevPlatformClient!(ClientName.Partners, appConfigSpec.schema)

      expect(() => schema.parse({app_preferences: {url: 'https://valid-url.com'}})).toThrow()
      expect(() =>
        schema.parse({application_url: 'https://valid-url.com', app_preferences: {url: 'https://valid-url.com'}}),
      ).toThrow()
      expect(() => schema.parse({embedded: true, app_preferences: {url: 'https://valid-url.com'}})).toThrow()

      expect(() =>
        schema.parse({
          application_url: 'https://valid-url.com',
          embedded: true,
          app_preferences: {
            url: 'https://valid-url.com',
          },
        }),
      ).not.toThrow()
    })

    test('when using non-Partners client, application_url and embedded fields remain optional', () => {
      const appConfigSpec = spec
      const schema = appConfigSpec.customizeSchemaForDevPlatformClient!(ClientName.AppManagement, appConfigSpec.schema)

      expect(() => schema.parse({})).not.toThrow()
      expect(() => schema.parse({application_url: 'https://valid-url.com'})).not.toThrow()
      expect(() => schema.parse({embedded: true})).not.toThrow()
      expect(() => schema.parse({app_preferences: {url: 'https://valid-url.com'}})).not.toThrow()
      expect(() =>
        schema.parse({
          application_url: 'https://valid-url.com',
          embedded: true,
          app_preferences: {
            url: 'https://valid-url.com',
          },
        }),
      ).not.toThrow()
    })
  })
})
