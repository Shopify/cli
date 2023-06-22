import {
  AppLocalStorageSchema,
  CurrentConfigLocalStorageSchema,
  clearAppInfo,
  clearCurrentConfigFile,
  getAppInfo,
  setAppInfo,
  setCurrentConfigFile,
} from './local-storage.js'
import {describe, expect, test} from 'vitest'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

const APP1 = {appId: 'app1', storeFqdn: 'store1', orgId: 'org1', directory: '/app1'}
const APP2 = {appId: 'app2', storeFqdn: 'store2', orgId: 'org2', directory: '/app2'}
const APP1Updated = {appId: 'updated-app1', storeFqdn: 'store1-updated', orgId: 'org1-updated', directory: '/app1'}

const APP1_WITH_CONFIG_FILE = {...APP1, configFile: 'shopify.app.staging.toml'}
const APP1_WITH_CONFIG_FILE_UPDATED = {...APP1Updated, configFile: 'shopify.app.staging.toml'}
const APP2_WITH_CONFIG_FILE = {...APP2, configFile: 'shopify.app.prod.toml'}

describe('getAppInfo', async () => {
  test('returns cached info if existss', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const storage = new LocalStorage<AppLocalStorageSchema>({cwd})
      setAppInfo(APP1, storage)

      // When
      const got = getAppInfo(APP1.directory, storage)

      // Then
      expect(got).toEqual(APP1)
    })
  })

  test('returns undefined if it does not exists', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const storage = new LocalStorage<AppLocalStorageSchema>({cwd})

      // When
      const got = getAppInfo('app3', storage)

      // Then
      expect(got).toEqual(undefined)
    })
  })
})

describe('setAppInfo', async () => {
  describe('with legacy app config', async () => {
    test('updates cached info if exists', async () => {
      await inTemporaryDirectory(async (cwd) => {
        // Given
        const storage = new LocalStorage<AppLocalStorageSchema>({cwd})
        storage.set(APP1.directory, APP1)

        // When
        setAppInfo(APP1Updated, storage)
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
        setAppInfo({appId: 'app2', directory: '/app2', storeFqdn: APP2.storeFqdn, orgId: APP2.orgId}, storage)
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
        setAppInfo(
          {appId: 'app2', directory: '\\app2\\something', storeFqdn: APP2.storeFqdn, orgId: APP2.orgId},
          storage,
        )
        const got = storage.get('/app2/something')

        // Then
        expect(got.appId).toEqual(APP2.appId)
      })
    })
  })

  describe('with specific app config file', async () => {
    test('updates cached info if exists', async () => {
      await inTemporaryDirectory(async (cwd) => {
        // Given
        const storage = new LocalStorage<AppLocalStorageSchema>({cwd})
        const filePath = joinPath(APP1_WITH_CONFIG_FILE.directory, APP1_WITH_CONFIG_FILE.configFile)
        storage.set(filePath, APP1_WITH_CONFIG_FILE)

        // When
        setAppInfo(APP1_WITH_CONFIG_FILE_UPDATED, storage)
        const got = storage.get(filePath)

        // Then
        expect(got).toEqual(APP1_WITH_CONFIG_FILE_UPDATED)
      })
    })

    test('creates new info if it does not exists', async () => {
      await inTemporaryDirectory(async (cwd) => {
        // Given
        const storage = new LocalStorage<AppLocalStorageSchema>({cwd})
        const filePath = joinPath(APP2_WITH_CONFIG_FILE.directory, APP2_WITH_CONFIG_FILE.configFile)

        // When
        setAppInfo(APP2_WITH_CONFIG_FILE, storage)
        const got = storage.get(filePath)

        // Then
        expect(got).toEqual(APP2_WITH_CONFIG_FILE)
      })
    })

    test('creates new info normalizing the path', async () => {
      await inTemporaryDirectory(async (cwd) => {
        // Given
        const storage = new LocalStorage<AppLocalStorageSchema>({cwd})
        const app = {...APP2_WITH_CONFIG_FILE, directory: '\\app2\\something'}

        // When
        setAppInfo(app, storage)
        const got = storage.get(joinPath('/app2/something', app.configFile))

        // Then
        expect(got.appId).toEqual(APP2.appId)
      })
    })
  })
})

describe('setCurrentConfigFile', async () => {
  test('adds key to current config local storage and calls setAppInfo', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const appStorage = new LocalStorage<AppLocalStorageSchema>({cwd})
      const currentConfigStorage = new LocalStorage<CurrentConfigLocalStorageSchema>({cwd})
      const appKey = joinPath(APP1_WITH_CONFIG_FILE.directory, APP1_WITH_CONFIG_FILE.configFile)

      // When/Then
      setCurrentConfigFile(APP1_WITH_CONFIG_FILE, appStorage, currentConfigStorage)
      expect(currentConfigStorage.get(APP1_WITH_CONFIG_FILE.directory)).toEqual(APP1_WITH_CONFIG_FILE.configFile)
      expect(appStorage.get(appKey)).toEqual(APP1_WITH_CONFIG_FILE)
    })
  })
})

describe('clearCurrentConfigFile', async () => {
  test('removes key from current config local storage', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const appStorage = new LocalStorage<AppLocalStorageSchema>({cwd})
      const currentConfigStorage = new LocalStorage<CurrentConfigLocalStorageSchema>({cwd})
      currentConfigStorage.set(APP1_WITH_CONFIG_FILE.directory, 'shopify.app.staging.toml')

      // When/Then
      clearCurrentConfigFile(APP1_WITH_CONFIG_FILE.directory, currentConfigStorage)
      expect(currentConfigStorage.get(APP1_WITH_CONFIG_FILE.directory)).toEqual(undefined)
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
      clearAppInfo(APP1.directory, storage)
      const got = getAppInfo(APP1.directory, storage)

      // Then
      expect(got).toEqual(undefined)
    })
  })
})
