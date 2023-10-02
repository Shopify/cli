import {fetchPartnersSession} from './partner-account-info.js'
import {getUserAccount} from '../../api/graphql/user_account.js'
import {PARTNERS_SESSION} from '../../models/app/app.test-data.js'
import {ensureAuthenticatedBusinessPlatform, ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('../../api/graphql/user_account.js')

describe('fetchPartnersSession', () => {
  test('when no errors returns complete partner info', async () => {
    // Given
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('tokenBusiness')
    vi.mocked(getUserAccount).mockResolvedValue({email: 'partner@shopify.com'})

    // When
    const got = await fetchPartnersSession()

    // Then
    expect(got).toEqual(PARTNERS_SESSION)
  })

  test('when error fetching user account returns incomplete partner info', async () => {
    // Given
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockRejectedValue(new AbortError('Error'))

    // When
    const got = await fetchPartnersSession()

    // Then
    expect(got).toEqual({token: 'token', accountInfo: {email: ''}})
  })
})
