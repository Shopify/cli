import spec from './app_config_hosted_app_home.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {copyDirectoryContents} from '@shopify/cli-kit/node/fs'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/fs')

describe('hosted_app_home', () => {
  describe('transform', () => {
    test('should return the transformed object preserving admin nesting', () => {
      const object = {
        admin: {static_root: 'public'},
      }
      const appConfigSpec = spec

      const result = appConfigSpec.transformLocalToRemote!(object, placeholderAppConfiguration)

      expect(result).toMatchObject({
        admin: {static_root: 'public'},
      })
    })

    test('should return empty object when admin.static_root is not provided', () => {
      const object = {}
      const appConfigSpec = spec

      const result = appConfigSpec.transformLocalToRemote!(object, placeholderAppConfiguration)

      expect(result).toMatchObject({})
    })
  })

  describe('reverseTransform', () => {
    test('should return the reversed transformed object preserving admin nesting', () => {
      const object = {
        admin: {static_root: 'public'},
      }
      const appConfigSpec = spec

      const result = appConfigSpec.transformRemoteToLocal!(object)

      expect(result).toMatchObject({
        admin: {static_root: 'public'},
      })
    })

    test('should return empty object when static_root is not provided', () => {
      const object = {}
      const appConfigSpec = spec

      const result = appConfigSpec.transformRemoteToLocal!(object)

      expect(result).toMatchObject({})
    })
  })

  describe('copyStaticAssets', () => {
    test('should copy static assets from source to output directory', async () => {
      vi.mocked(copyDirectoryContents).mockResolvedValue(undefined)
      const config = {admin: {static_root: 'public'}}
      const directory = '/app/root'
      const outputPath = '/output/dist/bundle.js'

      await spec.copyStaticAssets!(config, directory, outputPath)

      expect(copyDirectoryContents).toHaveBeenCalledWith('/app/root/public', '/output/dist')
    })

    test('should not copy assets when admin.static_root is not provided', async () => {
      const config = {}
      const directory = '/app/root'
      const outputPath = '/output/dist/bundle.js'

      await spec.copyStaticAssets!(config, directory, outputPath)

      expect(copyDirectoryContents).not.toHaveBeenCalled()
    })

    test('should throw error when copy fails', async () => {
      vi.mocked(copyDirectoryContents).mockRejectedValue(new Error('Permission denied'))
      const config = {admin: {static_root: 'public'}}
      const directory = '/app/root'
      const outputPath = '/output/dist/bundle.js'

      await expect(spec.copyStaticAssets!(config, directory, outputPath)).rejects.toThrow(
        'Failed to copy static assets from /app/root/public to /output/dist: Permission denied',
      )
    })
  })

  describe('buildConfig', () => {
    test('should have hosted_app_home build mode', () => {
      expect(spec.buildConfig).toEqual({mode: 'hosted_app_home'})
    })
  })

  describe('identifier', () => {
    test('should have correct identifier', () => {
      expect(spec.identifier).toBe('admin')
    })
  })
})
