import spec from './app_config_point_of_sale.js'
import {describe, expect, test} from 'vitest'

describe('app_cofig_point_of_sale', () => {
  describe('transformLocalToRemote', () => {
    test('should be undefined since deployConfig is used instead', () => {
      expect(spec.transformLocalToRemote).toBeUndefined()
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
