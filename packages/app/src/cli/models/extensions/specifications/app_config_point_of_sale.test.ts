import spec from './app_config_point_of_sale.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {describe, expect, test} from 'vitest'

describe('app_cofig_point_of_sale', () => {
  describe('transform', () => {
    test('should return the transformed object', () => {
      // Given
      const object = {
        pos: {
          embedded: true,
        },
      }
      const appConfigSpec = spec

      // When
      const result = appConfigSpec.transformLocalToRemote!(object, placeholderAppConfiguration)

      // Then
      expect(result).toMatchObject({
        embedded: true,
      })
    })
  })

  describe('reverseTransform', () => {
    test('should return the reversed transformed object', () => {
      // Given
      const object = {
        embedded: true,
      }
      const appConfigSpec = spec

      // When
      const result = appConfigSpec.transformRemoteToLocal!(object)

      // Then
      expect(result).toMatchObject({
        pos: {
          embedded: true,
        },
      })
    })
  })
})
