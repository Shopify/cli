import {IdentityClient} from './identity-client.js'
import {ApplicationToken, IdentityToken} from '../../session/schema.js'
import {ExchangeScopes, TokenRequestResult} from '../../session/exchange.js'
import {ok, Result} from '../../../../public/node/result.js'
import {allDefaultScopes} from '../../session/scopes.js'
import {applicationId} from '../../session/identity.js'

export class IdentityMockClient extends IdentityClient {
  private readonly mockUserId = '08978734-325e-44ce-bc65-34823a8d5180'
  private readonly authTokenPrefix = 'mtkn_'

  async requestAccessToken(_scopes: string[]): Promise<IdentityToken> {
    const tokens = this.generateTokens('identity')

    return Promise.resolve({
      accessToken: tokens.accessToken,
      alias: '',
      expiresAt: this.getFutureDate(1),
      refreshToken: tokens.refreshToken,
      scopes: allDefaultScopes(),
      userId: this.mockUserId,
    })
  }

  async exchangeAccessForApplicationTokens(
    _identityToken: IdentityToken,
    _scopes: ExchangeScopes,
    _store?: string,
  ): Promise<{[x: string]: ApplicationToken}> {
    return {
      [applicationId('app-management')]: this.generateTokens(applicationId('app-management')),
      [applicationId('business-platform')]: this.generateTokens(applicationId('business-platform')),
      [applicationId('admin')]: this.generateTokens(applicationId('admin')),
      [applicationId('partners')]: this.generateTokens(applicationId('partners')),
      [applicationId('storefront-renderer')]: this.generateTokens(applicationId('storefront-renderer')),
    }
  }

  async tokenRequest(params: {
    [key: string]: string
  }): Promise<Result<TokenRequestResult, {error: string; store?: string}>> {
    const tokens = this.generateTokens(params?.audience ?? '')
    return ok({
      access_token: tokens.accessToken,
      expires_in: this.getFutureDate(1).getTime(),
      refresh_token: tokens.refreshToken,
      scope: allDefaultScopes().join(' '),
    })
  }

  async refreshAccessToken(_currentToken: IdentityToken): Promise<IdentityToken> {
    const tokens = this.generateTokens('identity')

    return Promise.resolve({
      accessToken: tokens.accessToken,
      alias: 'dev@shopify.com',
      expiresAt: this.getFutureDate(1),
      refreshToken: tokens.refreshToken,
      scopes: allDefaultScopes(),
      userId: this.mockUserId,
    })
  }

  clientId(): string {
    return 'shopify-cli-development'
  }

  private readonly generateTokens = (appId: string) => {
    const now = this.getCurrentUnixTimestamp()
    const exp = now + 7200

    const tokenPayload = {
      act: {
        iss: 'https://identity.shop.dev',
        sub: this.clientId(),
      },
      aud: appId,
      client_id: this.clientId(),
      token_type: 'SLAT',
      exp,
      iat: now,
      iss: 'https://identity.shop.dev',
      scope: allDefaultScopes().join(' '),
      sub: this.mockUserId,
      sid: 'df63c65c-3731-48af-a28d-72ab16a6523a',
      auth_time: now,
      amr: ['pwd', 'device-auth'],
      device_uuid: '8ba644c8-7d2f-4260-9311-86df09195ee8',
      atl: 1.0,
    }

    const refreshTokenPayload = {
      ...tokenPayload,
      token_use: 'refresh',
    }

    return {
      accessToken: `${this.authTokenPrefix}${this.encodeTokenPayload(tokenPayload)}`,
      refreshToken: `${this.authTokenPrefix}${this.encodeTokenPayload(refreshTokenPayload)}`,
      expiresAt: new Date(exp * 1000),
      scopes: allDefaultScopes(),
    }
  }

  private getFutureDate(daysInFuture = 100): Date {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + daysInFuture)
    return futureDate
  }

  private getCurrentUnixTimestamp(): number {
    return Math.floor(Date.now() / 1000)
  }

  private encodeTokenPayload(payload: object): string {
    return Buffer.from(JSON.stringify(payload))
      .toString('base64')
      .replace(/[=]/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  }
}
