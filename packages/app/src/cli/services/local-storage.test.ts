import {AppLocalStorageSchema, clearAppInfo, getAppInfo, setAppInfo} from './local-storage.js'
import {describe, expect, test} from 'vitest'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'

const APP1 = {appId: 'app1', storeFqdn: 'store1', orgId: 'org1', directory: '/app1'}
const APP2 = {appId: 'app2', storeFqdn: 'store2', orgId: 'org2', directory: '/app2'}
const APP1Updated = {appId: 'updated-app1', storeFqdn: 'store1-updated', orgId: 'org1-updated', directory: '/app1'}

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
      setAppInfo({appId: 'app2', directory: '\\app2\\something', storeFqdn: APP2.storeFqdn, orgId: APP2.orgId}, storage)
      const got = storage.get('/app2/something')

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
      clearAppInfo(APP1.directory, storage)
      const got = getAppInfo(APP1.directory, storage)

      // Then
      expect(got).toEqual(undefined)
    })
  })
})
