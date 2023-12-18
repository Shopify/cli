import {AccountInfo, fetchPartnersSession} from './partner-account-info.js'
import {testPartnersServiceSession, testPartnersUserSession} from '../../models/app/app.test-data.js'
import {geCurrentAccountInfo} from '../../api/graphql/current_account_info.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('../../api/graphql/current_account_info.js')
vi.mock('@shopify/cli-kit/node/environment')

describe('fetchPartnersSession', () => {
  test('when user token no errors returns complete user account info', async () => {
    // Given
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
    const userAccountInfo: AccountInfo = {
      type: 'UserAccount',
      email: 'partner@shopify.com',
    }
    vi.mocked(geCurrentAccountInfo).mockResolvedValue(userAccountInfo)

    // When
    const got = await fetchPartnersSession()

    // Then
    expect(got).toEqual(testPartnersUserSession)
  })

  test('when partners token no errors returns complete user account info', async () => {
    // Given
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('partnersToken')
    const serviceAccountInfo: AccountInfo = {
      type: 'ServiceAccount',
      orgName: 'organization',
    }
    vi.mocked(geCurrentAccountInfo).mockResolvedValue(serviceAccountInfo)

    // When
    const got = await fetchPartnersSession()

    // Then
    expect(got).toEqual(testPartnersServiceSession)
  })

  test('when error fetching account info returns unkonwn partner info', async () => {
    // Given
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
    vi.mocked(geCurrentAccountInfo).mockRejectedValue(new AbortError('Error'))

    // When
    const got = await fetchPartnersSession()

    // Then
    expect(got).toEqual({token: 'token', accountInfo: {type: 'UnknownAccount'}})
  })
})
