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
    setCachedAccountInfo(userId, accountInfo)

    // When
    const got = await fetchCurrentAccountInformation(testDeveloperPlatformClient(), userId)

    // Then
    expect(got).toEqual(accountInfo)
    expect(outputDebug).toHaveBeenCalledWith('Getting partner account info from cache')
    expect(getCurrentAccountInfo).not.toHaveBeenCalled()
  })

  test('fetches and caches account info if not in cache', async () => {
    // Given
    vi.mocked(getCurrentAccountInfo).mockResolvedValue(accountInfo)

    // When
    const got = await fetchCurrentAccountInformation(testDeveloperPlatformClient(), userId)

    // Then
    expect(got).toEqual(accountInfo)

    // Verify that the info was cached
    const cachedInfo = getCachedAccountInfo(userId)
    expect(cachedInfo).toEqual(accountInfo)
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
