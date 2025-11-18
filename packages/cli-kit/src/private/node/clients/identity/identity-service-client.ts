import {IdentityClient} from './identity-client.js'
import {ApplicationToken, IdentityToken} from '../../session/schema.js'
import {ExchangeScopes} from '../../session/exchange.js'

export class IdentityServiceClient extends IdentityClient {
  async requestAccessToken(_scopes: string[]): Promise<IdentityToken> {
    return {} as IdentityToken
  }

  async exchangeAccessForApplicationTokens(
    _identityToken: IdentityToken,
    _scopes: ExchangeScopes,
    _store?: string,
  ): Promise<{[x: string]: ApplicationToken}> {
    return {}
  }

  async refreshAccessToken(_currentToken: IdentityToken): Promise<IdentityToken> {
    return {} as IdentityToken
  }
}
