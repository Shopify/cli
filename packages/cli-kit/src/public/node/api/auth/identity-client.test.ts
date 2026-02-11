import {createIdentityClient} from './identity-client.js'
import {
  exchangeAccessForApplicationTokens,
  exchangeCustomPartnerToken,
  exchangeCliTokenForAppManagementAccessToken,
  exchangeCliTokenForBusinessPlatformAccessToken,
  refreshAccessToken,
} from '../../../../private/node/session/exchange.js'
import {
  requestDeviceAuthorization,
  pollForDeviceAuthorization,
} from '../../../../private/node/session/device-authorization.js'
import {IdentityToken} from '../../../../private/node/session/schema.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../../../../private/node/session/exchange.js')
vi.mock('../../../../private/node/session/device-authorization.js')

const fakeIdentityToken: IdentityToken = {
  accessToken: 'identity-access-token',
  refreshToken: 'identity-refresh-token',
  expiresAt: new Date(Date.now() + 3600 * 1000),
  scopes: ['openid'],
  userId: 'user-123',
}

const fakeDeviceAuth = {
  deviceCode: 'device-code',
  userCode: 'user-code',
  verificationUri: 'https://example.com/verify',
  expiresIn: 600,
  verificationUriComplete: 'https://example.com/verify?code=user-code',
  interval: 5,
}

describe('createIdentityClient', () => {
  test('initiateDeviceAuth delegates to requestDeviceAuthorization', async () => {
    vi.mocked(requestDeviceAuthorization).mockResolvedValue(fakeDeviceAuth)

    const client = createIdentityClient()
    const result = await client.initiateDeviceAuth(['openid', 'profile'])

    expect(requestDeviceAuthorization).toHaveBeenCalledWith(['openid', 'profile'])
    expect(result).toBe(fakeDeviceAuth)
  })

  test('pollForDeviceApproval delegates to pollForDeviceAuthorization', async () => {
    vi.mocked(pollForDeviceAuthorization).mockResolvedValue(fakeIdentityToken)

    const client = createIdentityClient()
    const result = await client.pollForDeviceApproval('device-code', 10)

    expect(pollForDeviceAuthorization).toHaveBeenCalledWith('device-code', 10)
    expect(result).toBe(fakeIdentityToken)
  })

  test('exchangeAllTokens delegates to exchangeAccessForApplicationTokens', async () => {
    const fakeAppTokens = {partners: {accessToken: 'partner-token', expiresAt: new Date(), scopes: []}}
    vi.mocked(exchangeAccessForApplicationTokens).mockResolvedValue(fakeAppTokens)

    const scopes = {admin: [], partners: ['cli'], storefront: [], businessPlatform: [], appManagement: []}
    const client = createIdentityClient()
    const result = await client.exchangeAllTokens(fakeIdentityToken, {scopes, storeFqdn: 'store.myshopify.com'})

    expect(exchangeAccessForApplicationTokens).toHaveBeenCalledWith(fakeIdentityToken, scopes, 'store.myshopify.com')
    expect(result).toBe(fakeAppTokens)
  })

  test('refreshIdentityToken delegates to refreshAccessToken', async () => {
    const refreshedToken = {...fakeIdentityToken, accessToken: 'refreshed-access-token'}
    vi.mocked(refreshAccessToken).mockResolvedValue(refreshedToken)

    const client = createIdentityClient()
    const result = await client.refreshIdentityToken(fakeIdentityToken)

    expect(refreshAccessToken).toHaveBeenCalledWith(fakeIdentityToken)
    expect(result).toBe(refreshedToken)
  })

  test('exchangeCustomToken for partners delegates to exchangeCustomPartnerToken', async () => {
    vi.mocked(exchangeCustomPartnerToken).mockResolvedValue({accessToken: 'partner-token', userId: 'user-1'})

    const client = createIdentityClient()
    const result = await client.exchangeCustomToken('my-cli-token', 'partners')

    expect(exchangeCustomPartnerToken).toHaveBeenCalledWith('my-cli-token')
    expect(result).toEqual({accessToken: 'partner-token', userId: 'user-1'})
  })

  test('exchangeCustomToken for app-management delegates correctly', async () => {
    vi.mocked(exchangeCliTokenForAppManagementAccessToken).mockResolvedValue({
      accessToken: 'appmgmt-token',
      userId: 'user-2',
    })

    const client = createIdentityClient()
    const result = await client.exchangeCustomToken('my-cli-token', 'app-management')

    expect(exchangeCliTokenForAppManagementAccessToken).toHaveBeenCalledWith('my-cli-token')
    expect(result).toEqual({accessToken: 'appmgmt-token', userId: 'user-2'})
  })

  test('exchangeCustomToken for business-platform delegates correctly', async () => {
    vi.mocked(exchangeCliTokenForBusinessPlatformAccessToken).mockResolvedValue({
      accessToken: 'bp-token',
      userId: 'user-3',
    })

    const client = createIdentityClient()
    const result = await client.exchangeCustomToken('my-cli-token', 'business-platform')

    expect(exchangeCliTokenForBusinessPlatformAccessToken).toHaveBeenCalledWith('my-cli-token')
    expect(result).toEqual({accessToken: 'bp-token', userId: 'user-3'})
  })

  test('exchangeCustomToken throws for admin audience', async () => {
    const client = createIdentityClient()
    await expect(client.exchangeCustomToken('my-cli-token', 'admin')).rejects.toThrow(
      "Custom CLI token exchange is not supported for audience 'admin'",
    )
  })

  test('exchangeCustomToken throws for storefront-renderer audience', async () => {
    const client = createIdentityClient()
    await expect(client.exchangeCustomToken('my-cli-token', 'storefront-renderer')).rejects.toThrow(
      "Custom CLI token exchange is not supported for audience 'storefront-renderer'",
    )
  })
})
