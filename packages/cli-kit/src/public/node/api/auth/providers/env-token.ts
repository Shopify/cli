/**
 * EnvTokenProvider: checks SHOPIFY_CLI_PARTNERS_TOKEN and exchanges for the requested audience.
 * Extracts the env token handling currently duplicated across 3+ ensureAuthenticated* functions.
 */

import {CredentialProvider, ApiAudience, TokenContext} from '../credential-provider.js'
import {IdentityClient, createIdentityClient} from '../identity-client.js'
import {getPartnersToken} from '../../../environment.js'
import {setLastSeenAuthMethod, setLastSeenUserIdAfterAuth} from '../../../../../private/node/session.js'

export class EnvTokenProvider implements CredentialProvider {
  readonly name = 'EnvToken'
  private readonly identityClient: IdentityClient

  constructor(identityClient?: IdentityClient) {
    this.identityClient = identityClient ?? createIdentityClient()
  }

  async getToken(audience: ApiAudience, _context?: TokenContext): Promise<string | null> {
    const partnersToken = getPartnersToken()
    if (!partnersToken) return null

    // Env token doesn't support admin or storefront-renderer
    if (audience === 'admin' || audience === 'storefront-renderer') {
      return null
    }

    const result = await this.identityClient.exchangeCustomToken(partnersToken, audience)
    setLastSeenAuthMethod('partners_token')
    setLastSeenUserIdAfterAuth(result.userId)
    return result.accessToken
  }
}
