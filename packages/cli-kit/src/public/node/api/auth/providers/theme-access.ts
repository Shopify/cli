/**
 * ThemeAccessProvider: returns the password for admin and storefront-renderer audiences.
 * Extracts the password-handling conditionals from ensureAuthenticatedThemes and ensureAuthenticatedStorefront.
 */

import {CredentialProvider, ApiAudience, TokenContext} from '../credential-provider.js'
import {isThemeAccessSession} from '../../../../../private/node/api/rest.js'
import {setLastSeenAuthMethod, setLastSeenUserIdAfterAuth} from '../../../../../private/node/session.js'
import {nonRandomUUID} from '../../../crypto.js'

export class ThemeAccessProvider implements CredentialProvider {
  readonly name = 'ThemeAccess'

  async getToken(audience: ApiAudience, context?: TokenContext): Promise<string | null> {
    const password = context?.password
    if (!password) return null

    // Theme access tokens only work for admin and storefront-renderer
    if (audience !== 'admin' && audience !== 'storefront-renderer') {
      return null
    }

    const session = {token: password, storeFqdn: ''}
    const authMethod = isThemeAccessSession(session) ? 'theme_access_token' : 'custom_app_token'
    setLastSeenAuthMethod(authMethod)
    setLastSeenUserIdAfterAuth(nonRandomUUID(password))
    return password
  }
}
