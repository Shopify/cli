import {
  getConfigStoreForAccountInfoStatus,
  getCachedAccountInfo,
  setCachedAccountInfo,
  clearCachedAccountInfo,
} from './app-conf-store.js'
import {AccountInfo} from '@shopify/cli-kit/node/session'
import {vi, describe, test, expect, beforeEach, afterEach} from 'vitest'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'

describe('app-conf-store', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-01-01'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('getConfigStoreForAccountInfoStatus returns a LocalStorage instance', async () => {
    await inTemporaryDirectory(async (tempDir) => {
      const result = getConfigStoreForAccountInfoStatus(tempDir)
      expect(result).toBeInstanceOf(LocalStorage)
    })
  })

  describe('getCachedAccountInfo', () => {
    test('returns undefined when no cached data exists', async () => {
      await inTemporaryDirectory(async (tempDir) => {
        const result = getCachedAccountInfo('testSubject', tempDir)
        expect(result).toBeUndefined()
      })
    })

    test('returns undefined when cached data is expired', async () => {
      // More than 72 hours old
      await inTemporaryDirectory(async (tempDir) => {
        const loadedAt = new Date('2022-11-28').toISOString()

        const store = getConfigStoreForAccountInfoStatus(tempDir)
        await store.set('testSubject', {
          info: {type: 'UserAccount', email: 'test@example.com'} as AccountInfo,
          loadedAt,
        })

        const result = getCachedAccountInfo('testSubject', tempDir)
        expect(result).toBeUndefined()
      })
    })

    test('returns cached info when data is valid', async () => {
      await inTemporaryDirectory(async (tempDir) => {
        // Less than 72 hours old

        const validDate = new Date('2022-12-31').toISOString()
        const mockInfo: AccountInfo = {type: 'UserAccount', email: 'test@example.com'}
        const store = getConfigStoreForAccountInfoStatus(tempDir)
        await store.set('testSubject', {
          info: mockInfo,
          loadedAt: validDate,
        })

        const result = getCachedAccountInfo('testSubject', tempDir)
        expect(result).toEqual(mockInfo)
      })
    })
  })

  test('setCachedAccountInfo sets the data correctly', async () => {
    await inTemporaryDirectory(async (tempDir) => {
      const mockInfo: AccountInfo = {type: 'ServiceAccount', orgName: 'Test Org'}

      await setCachedAccountInfo('testSubject', mockInfo, tempDir)

      const store = getConfigStoreForAccountInfoStatus(tempDir)
      const result = await store.get('testSubject')
      expect(result).toEqual({
        info: mockInfo,
        loadedAt: '2023-01-01T00:00:00.000Z',
      })
    })
  })

  test('clearCachedAccountInfo clears the store', async () => {
    await inTemporaryDirectory(async (tempDir) => {
      const mockInfo: AccountInfo = {type: 'UnknownAccount'}
      await setCachedAccountInfo('testSubject', mockInfo, tempDir)

      await clearCachedAccountInfo(tempDir)

      const store = getConfigStoreForAccountInfoStatus(tempDir)
      const result = await store.get('testSubject')
      expect(result).toBeUndefined()
    })
  })
})
