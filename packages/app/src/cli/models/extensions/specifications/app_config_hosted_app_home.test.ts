import spec from './app_config_hosted_app_home.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {ExtensionInstance} from '../extension-instance.js'
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
    test('should use build_steps mode', () => {
      expect(spec.buildConfig.mode).toBe('build_steps')
    })

    test('should have static stepsConfig (not a function)', () => {
      if (spec.buildConfig.mode !== 'build_steps') {
        throw new Error('Expected build_steps mode')
      }
      expect(typeof spec.buildConfig.stepsConfig).toBe('object')
      expect(spec.buildConfig.stepsConfig).not.toBeNull()
    })

    test('should have copy-static-assets step with configPath reference', () => {
      if (spec.buildConfig.mode !== 'build_steps') {
        throw new Error('Expected build_steps mode')
      }

      const stepsConfig = spec.buildConfig.stepsConfig

      // Verify the build steps config
      expect(stepsConfig.steps).toHaveLength(1)
      expect(stepsConfig.steps[0]).toMatchObject({
        id: 'copy-static-assets',
        displayName: 'Copy Static Assets',
        type: 'copy_files',
        config: {
          strategy: 'directory',
          source: {configPath: 'static_root', optional: true}, // ← Uses configPath reference with optional flag
        },
      })
      expect(stepsConfig.stopOnError).toBe(true)
    })

    test('should not have skip callback (must be serializable)', () => {
      if (spec.buildConfig.mode !== 'build_steps') {
        throw new Error('Expected build_steps mode')
      }

      const step = spec.buildConfig.stepsConfig.steps[0]
      // No skip function - config must be pure data (serializable)
      expect(step?.skip).toBeUndefined()
    })

    test('config should be serializable to JSON', () => {
      if (spec.buildConfig.mode !== 'build_steps') {
        throw new Error('Expected build_steps mode')
      }

      // Should be able to serialize and deserialize without errors
      const serialized = JSON.stringify(spec.buildConfig.stepsConfig)
      expect(serialized).toBeDefined()

      const deserialized = JSON.parse(serialized)
      expect(deserialized.steps).toHaveLength(1)
      expect(deserialized.steps[0].config.source).toEqual({configPath: 'static_root', optional: true})
    })
  })

  describe('identifier', () => {
    test('should have correct identifier', () => {
      expect(spec.identifier).toBe('hosted_app_home')
    })
  })
})
