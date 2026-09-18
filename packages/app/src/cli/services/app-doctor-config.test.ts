import {requireDoctorConfigFileName, resolveDoctorConfigFileName} from './app-doctor-config.js'
import {getCachedAppInfo} from './local-storage.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('./local-storage.js', () => ({getCachedAppInfo: vi.fn()}))

beforeEach(() => {
  vi.mocked(getCachedAppInfo).mockReset()
})

describe('resolveDoctorConfigFileName', () => {
  test.each(['production-eu', 'shopify.app.production-eu.toml', 'Production EU'])(
    'canonicalizes the config name %s without reading cache',
    async (configName) => {
      await inTemporaryDirectory(async (directory) => {
        expect(resolveDoctorConfigFileName(directory, configName)).toBe('shopify.app.production-eu.toml')
        expect(getCachedAppInfo).not.toHaveBeenCalled()
      })
    },
  )

  test('uses the cached config instead of the default config', async () => {
    await inTemporaryDirectory(async (directory) => {
      vi.mocked(getCachedAppInfo).mockReturnValue({directory, configFile: 'shopify.app.production.toml'})

      expect(resolveDoctorConfigFileName(directory)).toBe('shopify.app.production.toml')
      expect(getCachedAppInfo).toHaveBeenCalledWith(directory)
    })
  })

  test('falls back to shopify.app.toml when no flag or cache is present', async () => {
    await inTemporaryDirectory(async (directory) => {
      expect(resolveDoctorConfigFileName(directory)).toBe('shopify.app.toml')
      expect(getCachedAppInfo).toHaveBeenCalledWith(directory)
    })
  })
})

describe('requireDoctorConfigFileName', () => {
  test('returns the selected file when it exists', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.staging.toml'), 'name = "Staging"\n')

      expect(requireDoctorConfigFileName(directory, 'staging')).toBe('shopify.app.staging.toml')
    })
  })

  test('rejects a missing selected config without falling back to a sibling', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.other.toml'), 'name = "Other"\n')

      expect(() => requireDoctorConfigFileName(directory, 'missing')).toThrow(AbortError)
      expect(() => requireDoctorConfigFileName(directory, 'missing')).toThrow(/shopify\.app\.missing\.toml/)
    })
  })

  test('rejects a stale cached config without falling back to the default file', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Default"\n')
      vi.mocked(getCachedAppInfo).mockReturnValue({directory, configFile: 'shopify.app.deleted.toml'})

      expect(() => requireDoctorConfigFileName(directory)).toThrow(AbortError)
      expect(() => requireDoctorConfigFileName(directory)).toThrow(/shopify\.app\.deleted\.toml/)
    })
  })
})
