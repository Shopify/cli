import {vi, describe, expect, it} from 'vitest'

import {store} from './session/store'
import {ApplicationToken, IdentityToken, Session} from './session/schema'
import {exchangeAccessForApplicationTokens, exchangeCodeForAccessToken} from './session/exchange'
import {ensureAuthenticated, OAuthApplications} from './session'
import {identity} from './environment/fqdn'
import {authorize} from './session/authorize'

vi.mock('./environment/fqdn')
vi.mock('./session/identity')
vi.mock('./session/authorize')
vi.mock('./session/exchange')
vi.mock('./session/scopes')
vi.mock('./session/store')

const code = {code: 'code', codeVerifier: 'verifier'}
const identityToken: IdentityToken = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  expiresAt: new Date(2022, 1, 1, 11),
  scopes: ['scope', 'scope2'],
}

const appTokens: {[x: string]: ApplicationToken} = {
  appId1: {
    accessToken: 'access_token',
    expiresAt: new Date(2022, 1, 1, 11),
    scopes: ['scope1'],
  },
  appId2: {
    accessToken: 'access_token',
    expiresAt: new Date(2022, 1, 1, 11),
    scopes: ['scope2'],
  },
}

const fqdn = 'fqdn.com'

describe('ensureAuthenticated', () => {
  it('handles authentication and saves session in store', async () => {
    // Given
    const oauth: OAuthApplications = {}
    vi.mocked(identity).mockResolvedValue(fqdn)
    vi.mocked(authorize).mockResolvedValue(code)
    vi.mocked(exchangeCodeForAccessToken).mockResolvedValue(identityToken)
    vi.mocked(exchangeAccessForApplicationTokens).mockResolvedValue(appTokens)

    const expectedSession: Session = {
      [fqdn]: {
        identity: identityToken,
        applications: appTokens,
      },
    }

    // When
    await ensureAuthenticated(oauth)

    // Then
    expect(store).toBeCalledWith(expectedSession)
  })
})
