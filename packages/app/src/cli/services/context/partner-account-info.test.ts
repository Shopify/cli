import {AccountInfo, fetchCurrentAccountInformation} from './partner-account-info.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {getCurrentAccountInfo} from '../../api/graphql/current_account_info.js'
import {describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('../../api/graphql/current_account_info.js')
vi.mock('@shopify/cli-kit/node/environment')

describe('fetchCurrentAccountInformation', () => {
  test('returns complete user account info', async () => {
    // Given
    const userAccountInfo: AccountInfo = {
      type: 'UserAccount',
      email: 'partner@shopify.com',
    }
    vi.mocked(getCurrentAccountInfo).mockResolvedValue(userAccountInfo)

    // When
    const got = await fetchCurrentAccountInformation(testDeveloperPlatformClient())

    // Then
    expect(got).toEqual(userAccountInfo)
  })

  test('when error fetching account info returns unkonwn partner info', async () => {
    // Given
    vi.mocked(getCurrentAccountInfo).mockRejectedValue(new AbortError('Error'))

    // When
    const got = await fetchCurrentAccountInformation(testDeveloperPlatformClient())

    // Then
    expect(got).toEqual({type: 'UnknownAccount'})
  })
})
