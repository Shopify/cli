import {
  AppLocalStorageSchema,
  clearCachedAppInfo,
  clearCurrentConfigFile,
  getCachedAppInfo,
  setCachedAppInfo,
} from './local-storage.js'
import {describe, expect, test} from 'vitest'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'

const APP1 = {appId: 'app1', storeFqdn: 'store1', orgId: 'org1', directory: '/app1'}
const APP2 = {appId: 'app2', storeFqdn: 'store2', orgId: 'org2', directory: '/app2'}
const APP1Updated = {appId: 'updated-app1', storeFqdn: 'store1-updated', orgId: 'org1-updated', directory: '/app1'}
const APP1_WITH_CONFIG_FILE = {...APP1, configFile: 'shopify.app.staging.toml'}

describe('getAppInfo', async () => {
  test('returns cached info if existss', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const storage = new LocalStorage<AppLocalStorageSchema>({cwd})
      setCachedAppInfo(APP1, storage)

      // When
      const got = getCachedAppInfo(APP1.directory, storage)

      // Then
      expect(got).toEqual(APP1)
    })
  })

  test('returns undefined if it does not exists', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const storage = new LocalStorage<AppLocalStorageSchema>({cwd})

      // When
      const got = getCachedAppInfo('app3', storage)

      // Then
      expect(got).toEqual(undefined)
    })
  })
})

describe('setAppInfo', async () => {
  test('updates cached info if exists', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const storage = new LocalStorage<AppLocalStorageSchema>({cwd})
      storage.set(APP1.directory, APP1)

      // When
      setCachedAppInfo(APP1Updated, storage)
      const got = storage.get(APP1.directory)

      // Then
      expect(got).toEqual(APP1Updated)
    })
  })

  test('creates new info if it does not exists', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const storage = new LocalStorage<AppLocalStorageSchema>({cwd})

      // When
      setCachedAppInfo({appId: 'app2', directory: '/app2', storeFqdn: APP2.storeFqdn, orgId: APP2.orgId}, storage)
      const got = storage.get(APP2.directory)

      // Then
      expect(got).toEqual(APP2)
    })
  })

  test('creates new info normalizing the path', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const storage = new LocalStorage<AppLocalStorageSchema>({cwd})

      // When
      setCachedAppInfo(
        {appId: 'app2', directory: '\\app2\\something', storeFqdn: APP2.storeFqdn, orgId: APP2.orgId},
        storage,
      )
      const got = storage.get('/app2/something')!

      // Then
      expect(got.appId).toEqual(APP2.appId)
    })
  })
})

describe('clearAppInfo', async () => {
  test('removes cached info if exists', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const storage = new LocalStorage<AppLocalStorageSchema>({cwd})
      storage.set(APP1.directory, APP1)
      storage.set(APP2.directory, APP2)

      // When
      clearCachedAppInfo(APP1.directory, storage)
      const got = getCachedAppInfo(APP1.directory, storage)

      // Then
      expect(got).toEqual(undefined)
    })
  })
})

describe('clearCurrentConfigFile', async () => {
  test('removes key from current config local storage', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const storage = new LocalStorage<AppLocalStorageSchema>({cwd})
      setCachedAppInfo({directory: APP1_WITH_CONFIG_FILE.directory, configFile: 'shopify.app.staging.toml'}, storage)

      // When
      clearCurrentConfigFile(APP1_WITH_CONFIG_FILE.directory, storage)
      const got = getCachedAppInfo(APP1_WITH_CONFIG_FILE.directory, storage)

      // Then
      expect(got).toBeDefined()
      expect(got!.configFile).toBeUndefined()
    })
  })

  test('no-ops if there is no current config in local storage', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const storage = new LocalStorage<AppLocalStorageSchema>({cwd})

      // When
      clearCurrentConfigFile(APP1_WITH_CONFIG_FILE.directory, storage)
      const got = getCachedAppInfo(APP1_WITH_CONFIG_FILE.directory, storage)

      // Then
      expect(got).toBeUndefined()
    })
  })
})
