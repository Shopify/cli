import {
  getConfigStoreForAccountInfoStatus,
  getCachedAccountInfo,
  setCachedAccountInfo,
  clearCachedAccountInfo,
} from './app-conf-store.js'
import {AccountInfo} from '../services/context/partner-account-info.js'
import {vi, describe, test, expect, beforeEach, afterEach} from 'vitest'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('app-conf-store', () => {
  let tempDir: string

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-01-01'))
    await inTemporaryDirectory(async (dir) => {
      tempDir = dir
      process.env.XDG_CONFIG_HOME = joinPath(tempDir, '.config')
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.XDG_CONFIG_HOME
  })

  test('getConfigStoreForAccountInfoStatus returns a LocalStorage instance', () => {
    const result = getConfigStoreForAccountInfoStatus()
    expect(result).toBeInstanceOf(LocalStorage)
  })

  describe('getCachedAccountInfo', () => {
    test('returns undefined when no cached data exists', () => {
      const result = getCachedAccountInfo('testSubject')
      expect(result).toBeUndefined()
    })

    test('returns undefined when cached data is expired', async () => {
      // More than 72 hours old
      const loadedAt = new Date('2022-11-28').toISOString()
      const store = getConfigStoreForAccountInfoStatus()
      await store.set('testSubject', {
        info: {type: 'UserAccount', email: 'test@example.com'} as AccountInfo,
        loadedAt,
      })

      const result = getCachedAccountInfo('testSubject')
      expect(result).toBeUndefined()
    })

    test('returns cached info when data is valid', async () => {
      // Less than 72 hours old
      const validDate = new Date('2022-12-31').toISOString()
      const mockInfo: AccountInfo = {type: 'UserAccount', email: 'test@example.com'}
      const store = getConfigStoreForAccountInfoStatus()
      await store.set('testSubject', {
        info: mockInfo,
        loadedAt: validDate,
      })

      const result = getCachedAccountInfo('testSubject')
      expect(result).toEqual(mockInfo)
    })
  })

  test('setCachedAccountInfo sets the data correctly', async () => {
    const mockInfo: AccountInfo = {type: 'ServiceAccount', orgName: 'Test Org'}
    await setCachedAccountInfo('testSubject', mockInfo)

    const store = getConfigStoreForAccountInfoStatus()
    const result = await store.get('testSubject')
    expect(result).toEqual({
      info: mockInfo,
      loadedAt: '2023-01-01T00:00:00.000Z',
    })
  })

  test('clearCachedAccountInfo clears the store', async () => {
    const mockInfo: AccountInfo = {type: 'UnknownAccount'}
    await setCachedAccountInfo('testSubject', mockInfo)

    await clearCachedAccountInfo()

    const store = getConfigStoreForAccountInfoStatus()
    const result = await store.get('testSubject')
    expect(result).toBeUndefined()
  })
})
