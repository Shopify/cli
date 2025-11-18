import {ApplicationToken, IdentityToken} from '../../session/schema.js'
import {ExchangeScopes} from '../../session/exchange.js'
import {API} from '../../api.js'

export abstract class IdentityClient {
  abstract requestAccessToken(scopes: string[]): Promise<IdentityToken>

  abstract exchangeAccessForApplicationTokens(
    identityToken: IdentityToken,
    scopes: ExchangeScopes,
    store?: string,
  ): Promise<{[x: string]: ApplicationToken}>

  abstract refreshAccessToken(currentToken: IdentityToken): Promise<IdentityToken>

  clientId(): string {
    return ''
  }

  applicationId(_api: API): string {
    return ''
  }
}
