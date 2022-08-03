import {applicationId} from './identity.js'
import {ApplicationToken, IdentityToken} from './schema.js'
import constants from '../constants.js'
import {OAuthApplications} from '../session.js'
import {identity, partners} from '../api.js'
import {debug} from '../output.js'
import {firstPartyDev} from '../environment/local.js'

type ValidationResult = 'needs_refresh' | 'needs_full_auth' | 'ok'

/**
 * Validate if an identity token is valid for the requested scopes
 * @param requestedScopes scopes
 * @param identity
 * @returns
 */
function validateScopes(requestedScopes: string[], identity: IdentityToken) {
  const currentScopes = identity.scopes
  if (firstPartyDev() !== currentScopes.includes('employee')) return false
  return requestedScopes.every((scope) => currentScopes.includes(scope))
}

/**
 * Validate if the current session is valid or we need to refresh/re-authenticate
 * @param scopes {string[]} requested scopes to validate
 * @param applications {OAuthApplications} requested applications
 * @param session current session with identity and application tokens
 * @returns {ValidationResult} 'ok' if the session is valid, 'needs_full_auth' if we need to re-authenticate, 'needs_refresh' if we need to refresh the session
 */
export async function validateSession(
  scopes: string[],
  applications: OAuthApplications,
  session: {
    identity: IdentityToken
    applications: {[x: string]: ApplicationToken}
  },
): Promise<ValidationResult> {
  if (!session) return 'needs_full_auth'
  const scopesAreValid = validateScopes(scopes, session.identity)
  const identityIsValid = await identity.validateIdentityToken(session.identity.accessToken)
  if (!scopesAreValid) return 'needs_full_auth'
  let tokensAreExpired = isTokenExpired(session.identity)
  let tokensAreRevoked = false

  if (applications.partnersApi) {
    const appId = applicationId('partners')
    const token = session.applications[appId]
    tokensAreRevoked = tokensAreRevoked || (await isPartnersTokenRevoked(token))
    tokensAreExpired = tokensAreExpired || isTokenExpired(token)
  }

  if (applications.storefrontRendererApi) {
    const appId = applicationId('storefront-renderer')
    const token = session.applications[appId]
    tokensAreExpired = tokensAreExpired || isTokenExpired(token)
  }

  if (applications.adminApi) {
    const appId = applicationId('admin')
    const realAppId = `${applications.adminApi.storeFqdn}-${appId}`
    const token = session.applications[realAppId]
    tokensAreExpired = tokensAreExpired || isTokenExpired(token)
  }

  debug(`
The validation of the token for application/identity completed with the following results:
- It's expired: ${tokensAreExpired}
- It's been revoked: ${tokensAreRevoked}
- It's invalid in identity: ${!identityIsValid}
  `)

  if (tokensAreExpired) return 'needs_refresh'
  if (tokensAreRevoked) return 'needs_full_auth'
  if (!identityIsValid) return 'needs_full_auth'
  return 'ok'
}

function isTokenExpired(token: ApplicationToken): boolean {
  if (!token) return true
  return token.expiresAt < expireThreshold()
}

async function isPartnersTokenRevoked(token: ApplicationToken) {
  if (!token) return false
  return partners.checkIfTokenIsRevoked(token.accessToken)
}

function expireThreshold(): Date {
  return new Date(Date.now() + constants.session.expirationTimeMarginInMinutes * 60 * 1000)
}
