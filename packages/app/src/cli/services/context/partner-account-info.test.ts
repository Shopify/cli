import {AccountInfo, fetchCurrentAccountInformation} from './partner-account-info.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {getCurrentAccountInfo} from '../../api/graphql/current_account_info.js'
import {clearCachedAccountInfo, getCachedAccountInfo, setCachedAccountInfo} from '../../utilities/app-conf-store.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('../../api/graphql/current_account_info.js')
vi.mock('@shopify/cli-kit/node/environment')
vi.mock('@shopify/cli-kit/node/output')

// Remove the mock for app-conf-store
// vi.mock('../../utilities/app-conf-store.js')

const userId = '1234-5678'

describe('fetchCurrentAccountInformation', () => {
  beforeEach(() => {
    clearCachedAccountInfo()
  })

  test('returns cached account info if available', async () => {
    // Given
    const cachedInfo: AccountInfo = {
      type: 'UserAccount',
      email: 'cached@shopify.com',
    }

    setCachedAccountInfo(userId, cachedInfo)

    // When
    const got = await fetchCurrentAccountInformation(testDeveloperPlatformClient(), userId)

    // Then
    expect(got).toEqual(cachedInfo)
    expect(outputDebug).toHaveBeenCalledWith('Getting partner account info from cache')
    expect(getCurrentAccountInfo).not.toHaveBeenCalled()
  })

  test('fetches and caches account info if not in cache', async () => {
    // Given
    const userAccountInfo: AccountInfo = {
      type: 'UserAccount',
      email: 'partner@shopify.com',
    }
    vi.mocked(getCurrentAccountInfo).mockResolvedValue(userAccountInfo)

    // When
    const got = await fetchCurrentAccountInformation(testDeveloperPlatformClient(), userId)

    // Then
    expect(got).toEqual(userAccountInfo)

    // Verify that the info was cached
    const cachedInfo = getCachedAccountInfo(userId)
    expect(cachedInfo).toEqual(userAccountInfo)
  })

  test('when error fetching account info returns unknown partner info', async () => {
    // Given
    clearCachedAccountInfo()
    vi.mocked(getCurrentAccountInfo).mockRejectedValue(new AbortError('Error'))

    // When
    const got = await fetchCurrentAccountInformation(testDeveloperPlatformClient(), userId)

    // Then
    expect(got).toEqual({type: 'UnknownAccount'})
    expect(outputDebug).toHaveBeenCalledWith('Error fetching user account info')

    // Verify that no info was cached
    const cachedInfo = getCachedAccountInfo(userId)
    expect(cachedInfo).toBeUndefined()
  })
})
