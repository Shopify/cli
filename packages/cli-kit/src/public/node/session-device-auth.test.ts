import {resumeDeviceAuthLogin, startDeviceAuthLogin} from './session.js'
import {identityFqdn} from './context/fqdn.js'
import {err, ok} from './result.js'
import {
  clearPendingDeviceAuth,
  getPendingDeviceAuth,
  setCurrentSessionId,
  setPendingDeviceAuth,
} from '../../private/node/conf-store.js'
import {completeAuthFlow} from '../../private/node/session.js'
import {requestDeviceAuthorization} from '../../private/node/session/device-authorization.js'
import {exchangeDeviceCodeForAccessToken} from '../../private/node/session/exchange.js'
import {allDefaultScopes} from '../../private/node/session/scopes.js'
import * as sessionStore from '../../private/node/session/store.js'
import {IdentityToken, Session} from '../../private/node/session/schema.js'

import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./context/fqdn.js')
vi.mock('../../private/node/conf-store.js')
vi.mock('../../private/node/session.js')
vi.mock('../../private/node/session/device-authorization.js')
vi.mock('../../private/node/session/exchange.js')
vi.mock('../../private/node/session/scopes.js')
vi.mock('../../private/node/session/store.js')

const identityToken: IdentityToken = {
  accessToken: 'identity-access-token',
  refreshToken: 'identity-refresh-token',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  scopes: ['openid'],
  userId: 'user-id',
}

const session: Session = {
  identity: {...identityToken, alias: 'user@example.com'},
  applications: {},
}

const pendingDeviceAuth = {
  deviceCode: 'device-code',
  userCode: 'ABCD-EFGH',
  verificationUriComplete: 'https://accounts.shopify.com/activate?user_code=ABCD-EFGH',
  interval: 5,
  expiresAt: Date.now() + 60_000,
}

describe('startDeviceAuthLogin', () => {
  beforeEach(() => {
    vi.mocked(allDefaultScopes).mockReturnValue(['openid'])
    vi.mocked(requestDeviceAuthorization).mockResolvedValue({
      deviceCode: pendingDeviceAuth.deviceCode,
      userCode: pendingDeviceAuth.userCode,
      verificationUri: 'https://accounts.shopify.com/activate',
      verificationUriComplete: pendingDeviceAuth.verificationUriComplete,
      interval: pendingDeviceAuth.interval,
      expiresIn: 600,
    })
  })

  test('starts device auth and stashes the code for resume', async () => {
    // When
    const got = await startDeviceAuthLogin()

    // Then
    expect(requestDeviceAuthorization).toHaveBeenCalledWith(['openid'], {noPrompt: true})
    expect(setPendingDeviceAuth).toHaveBeenCalledWith({
      deviceCode: pendingDeviceAuth.deviceCode,
      userCode: pendingDeviceAuth.userCode,
      verificationUriComplete: pendingDeviceAuth.verificationUriComplete,
      interval: pendingDeviceAuth.interval,
      expiresAt: expect.any(Number),
    })
    expect(got).toEqual({
      verificationUriComplete: pendingDeviceAuth.verificationUriComplete,
      userCode: pendingDeviceAuth.userCode,
      expiresAt: expect.any(String),
    })
  })
})

describe('resumeDeviceAuthLogin', () => {
  beforeEach(() => {
    vi.mocked(identityFqdn).mockResolvedValue('accounts.shopify.com')
    vi.mocked(getPendingDeviceAuth).mockReturnValue(pendingDeviceAuth)
    vi.mocked(exchangeDeviceCodeForAccessToken).mockResolvedValue(ok(identityToken))
    vi.mocked(completeAuthFlow).mockResolvedValue(session)
    vi.mocked(sessionStore.fetch).mockResolvedValue(undefined)
  })

  test('exchanges the stashed device code and stores the session', async () => {
    // When
    const got = await resumeDeviceAuthLogin()

    // Then
    expect(exchangeDeviceCodeForAccessToken).toHaveBeenCalledWith('device-code')
    expect(completeAuthFlow).toHaveBeenCalledWith(identityToken, {})
    expect(sessionStore.store).toHaveBeenCalledWith({
      'accounts.shopify.com': {
        'user-id': session,
      },
    })
    expect(setCurrentSessionId).toHaveBeenCalledWith('user-id')
    expect(clearPendingDeviceAuth).toHaveBeenCalledOnce()
    expect(got).toEqual({status: 'success', alias: 'user@example.com'})
  })

  test('returns pending while the user has not authorized yet', async () => {
    // Given
    vi.mocked(exchangeDeviceCodeForAccessToken).mockResolvedValue(err('authorization_pending'))

    // When
    const got = await resumeDeviceAuthLogin()

    // Then
    expect(got).toEqual({
      status: 'pending',
      verificationUriComplete: pendingDeviceAuth.verificationUriComplete,
      userCode: pendingDeviceAuth.userCode,
    })
    expect(clearPendingDeviceAuth).not.toHaveBeenCalled()
  })

  test('clears the pending state when it has expired', async () => {
    // Given
    vi.mocked(getPendingDeviceAuth).mockReturnValue({...pendingDeviceAuth, expiresAt: Date.now() - 1000})

    // When
    const got = await resumeDeviceAuthLogin()

    // Then
    expect(exchangeDeviceCodeForAccessToken).not.toHaveBeenCalled()
    expect(clearPendingDeviceAuth).toHaveBeenCalledOnce()
    expect(got.status).toBe('expired')
  })

  test('returns no_pending when there is no stashed code', async () => {
    // Given
    vi.mocked(getPendingDeviceAuth).mockReturnValue(undefined)

    // When
    const got = await resumeDeviceAuthLogin()

    // Then
    expect(exchangeDeviceCodeForAccessToken).not.toHaveBeenCalled()
    expect(got.status).toBe('no_pending')
  })
})
