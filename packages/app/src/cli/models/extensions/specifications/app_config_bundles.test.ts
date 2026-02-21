import spec from './app_config_bundles.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {describe, expect, test} from 'vitest'

describe('app_config_bundles', () => {
  describe('transform', () => {
    test('transforms local config to remote format', () => {
      // Given
      const object = {bundles: {purchase_options: true}}

      // When
      const result = spec.transformLocalToRemote!(object, placeholderAppConfiguration)

      // Then
      expect(result).toMatchObject({purchase_options: true})
    })
  })

  describe('reverseTransform', () => {
    test('transforms remote format back to local config', () => {
      // Given
      const object = {purchase_options: true}

      // When
      const result = spec.transformRemoteToLocal!(object)

      // Then
      expect(result).toMatchObject({bundles: {purchase_options: true}})
    })
  })
})
