import spec from './app_config_hosted_app_home.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {describe, expect, test} from 'vitest'

describe('hosted_app_home', () => {
  describe('transform', () => {
    test('should return the transformed object with static_root', () => {
      const object = {
        static_root: 'public',
      }
      const appConfigSpec = spec

      const result = appConfigSpec.transformLocalToRemote!(object, placeholderAppConfiguration)

      expect(result).toMatchObject({
        static_root: 'public',
      })
    })

    test('should return empty object when static_root is not provided', () => {
      const object = {}
      const appConfigSpec = spec

      const result = appConfigSpec.transformLocalToRemote!(object, placeholderAppConfiguration)

      expect(result).toMatchObject({})
    })
  })

  describe('reverseTransform', () => {
    test('should return the reversed transformed object with static_root', () => {
      const object = {
        static_root: 'public',
      }
      const appConfigSpec = spec

      const result = appConfigSpec.transformRemoteToLocal!(object)

      expect(result).toMatchObject({
        static_root: 'public',
      })
    })

    test('should return empty object when static_root is not provided', () => {
      const object = {}
      const appConfigSpec = spec

      const result = appConfigSpec.transformRemoteToLocal!(object)

      expect(result).toMatchObject({})
    })
  })

  describe('buildConfig', () => {
    test('should use copy_files mode', () => {
      expect(spec.buildConfig.mode).toBe('copy_files')
    })

    test('should have copy-static-assets step with tomlKey entry', () => {
      if (spec.buildConfig.mode === 'none') {
        throw new Error('Expected build_steps mode')
      }

      expect(spec.buildConfig.steps).toHaveLength(1)
      expect(spec.buildConfig.steps![0]).toMatchObject({
        id: 'copy-static-assets',
        displayName: 'Copy Static Assets',
        type: 'copy_files',
        config: {
          strategy: 'files',
          definition: {files: [{tomlKey: 'static_root'}]},
        },
      })
      expect(spec.buildConfig.stopOnError).toBe(true)
    })

    test('config should be serializable to JSON', () => {
      if (spec.buildConfig.mode === 'none') {
        throw new Error('Expected build_steps mode')
      }

      const serialized = JSON.stringify(spec.buildConfig)
      expect(serialized).toBeDefined()

      const deserialized = JSON.parse(serialized)
      expect(deserialized.steps).toHaveLength(1)
      expect(deserialized.steps[0].config).toEqual({
        strategy: 'files',
        definition: {files: [{tomlKey: 'static_root'}]},
      })
    })
  })

  describe('identifier', () => {
    test('should have correct identifier', () => {
      expect(spec.identifier).toBe('hosted_app_home')
    })
  })
})
