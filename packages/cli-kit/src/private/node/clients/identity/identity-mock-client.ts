import {IdentityClient, type TokenRequestResult, type DeviceAuthorizationResponse} from './identity-client.js'
import {ok, Result} from '../../../../public/node/result.js'
import {allDefaultScopes} from '../../session/scopes.js'

export class IdentityMockClient extends IdentityClient {
  private readonly mockUserId = '08978734-325e-44ce-bc65-34823a8d5180'
  private readonly authTokenPrefix = 'mtkn_'

  async requestDeviceAuthorization(_scopes: string[]): Promise<DeviceAuthorizationResponse> {
    return Promise.resolve({
      deviceCode: 'mock_device_code',
      userCode: 'MOCK-CODE',
      verificationUri: 'https://identity.shop.dev/device',
      expiresIn: 600,
      verificationUriComplete: 'https://identity.shop.dev/device?code=MOCK-CODE',
      interval: 5,
    })
  }

  async tokenRequest(params: {
    [key: string]: string
  }): Promise<Result<TokenRequestResult, {error: string; store?: string}>> {
    const tokens = this.generateTokens(params?.audience ?? '')
    const idTokenPayload = {
      sub: this.mockUserId,
      aud: params?.audience ?? 'identity',
      iss: 'https://identity.shop.dev',
      exp: this.getCurrentUnixTimestamp() + 7200,
      iat: this.getCurrentUnixTimestamp(),
    }
    return ok({
      access_token: tokens.accessToken,
      expires_in: this.getFutureDate(1).getTime(),
      refresh_token: tokens.refreshToken,
      scope: allDefaultScopes().join(' '),
      id_token: this.generateMockJWT(idTokenPayload),
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

  private generateMockJWT(payload: object): string {
    const header = {alg: 'none', typ: 'JWT'}
    const encodedHeader = this.encodeTokenPayload(header)
    const encodedPayload = this.encodeTokenPayload(payload)
    return `${encodedHeader}.${encodedPayload}.`
  }
}
