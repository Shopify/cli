import {fetchCurrentAccountInformation} from './partner-account-info.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {clearCachedAccountInfo, getCachedAccountInfo, setCachedAccountInfo} from '../../utilities/app-conf-store.js'
import {AccountInfo} from '@shopify/cli-kit/node/session'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/output')

const userId = '1234-5678'
const accountInfo: AccountInfo = {
  type: 'UserAccount',
  email: 'partner@shopify.com',
}

describe('fetchCurrentAccountInformation', () => {
  beforeEach(() => {
    clearCachedAccountInfo()
  })

  test('returns cached account info if available', async () => {
    // Given
    const currentAccountInfo = vi.fn()
    const developerPlatformClient = testDeveloperPlatformClient({currentAccountInfo})
    setCachedAccountInfo(userId, accountInfo)

    // When
    const got = await fetchCurrentAccountInformation(developerPlatformClient, userId)

    // Then
    expect(got).toEqual(accountInfo)
    expect(outputDebug).toHaveBeenCalledWith('Getting partner account info from cache')
    expect(currentAccountInfo).not.toHaveBeenCalled()
  })

  test('fetches user account info and caches it if not in cache', async () => {
    // Given
    const currentAccountInfo = vi.fn(async () => ({
      currentAccountInfo: {
        __typename: 'UserAccount' as const,
        email: accountInfo.email,
      },
    }))
    const developerPlatformClient = testDeveloperPlatformClient({currentAccountInfo})

    // When
    const got = await fetchCurrentAccountInformation(developerPlatformClient, userId)

    // Then
    expect(got).toEqual(accountInfo)
    expect(currentAccountInfo).toHaveBeenCalled()

    const cachedInfo = getCachedAccountInfo(userId)
    expect(cachedInfo).toEqual(accountInfo)
  })

  test('fetches service account info and caches it if not in cache', async () => {
    // Given
    const serviceAccountInfo: AccountInfo = {
      type: 'ServiceAccount',
      orgName: 'Test Org',
    }
    const currentAccountInfo = vi.fn(async () => ({
      currentAccountInfo: {
        __typename: 'ServiceAccount' as const,
        orgName: serviceAccountInfo.orgName,
      },
    }))
    const developerPlatformClient = testDeveloperPlatformClient({currentAccountInfo})

    // When
    const got = await fetchCurrentAccountInformation(developerPlatformClient, userId)

    // Then
    expect(got).toEqual(serviceAccountInfo)
    expect(getCachedAccountInfo(userId)).toEqual(serviceAccountInfo)
  })

  test('when error fetching account info returns unknown partner info', async () => {
    // Given
    clearCachedAccountInfo()
    const currentAccountInfo = vi.fn(async () => {
      throw new AbortError('Error')
    })
    const developerPlatformClient = testDeveloperPlatformClient({currentAccountInfo})

    // When
    const got = await fetchCurrentAccountInformation(developerPlatformClient, userId)

    // Then
    expect(got).toEqual({type: 'UnknownAccount'})
    expect(outputDebug).toHaveBeenCalledWith('Error fetching user account info')

    const cachedInfo = getCachedAccountInfo(userId)
    expect(cachedInfo).toBeUndefined()
  })
})
