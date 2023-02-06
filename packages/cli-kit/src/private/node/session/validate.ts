import {applicationId} from './identity.js'
import {ApplicationToken, IdentityToken} from './schema.js'
import {validateIdentityToken} from './identity-token-validation.js'
import {sessionConstants} from '../constants.js'
import {outputDebug} from '../../../public/node/output.js'
import {firstPartyDev} from '../../../public/node/context/local.js'
import {OAuthApplications} from '../session.js'

type ValidationResult = 'needs_refresh' | 'needs_full_auth' | 'ok'

/**
 * Validate if an identity token is valid for the requested scopes
 */
function validateScopes(requestedScopes: string[], identity: IdentityToken) {
  const currentScopes = identity.scopes
  if (firstPartyDev() !== currentScopes.includes('employee')) return false
  return requestedScopes.every((scope) => currentScopes.includes(scope))
}

/**
 * Validate if the current session is valid or we need to refresh/re-authenticate
 * @param scopes - requested scopes to validate
 * @param applications - requested applications
 * @param session - current session with identity and application tokens
 * @returns 'ok' if the session is valid, 'needs_full_auth' if we need to re-authenticate, 'needs_refresh' if we need to refresh the session
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
  const identityIsValid = await validateIdentityToken(session.identity.accessToken)
  if (!scopesAreValid) return 'needs_full_auth'
  let tokensAreExpired = isTokenExpired(session.identity)

  if (applications.partnersApi) {
    const appId = applicationId('partners')
    const token = session.applications[appId]!
    tokensAreExpired = tokensAreExpired || isTokenExpired(token)
  }

  if (applications.storefrontRendererApi) {
    const appId = applicationId('storefront-renderer')
    const token = session.applications[appId]!
    tokensAreExpired = tokensAreExpired || isTokenExpired(token)
  }

  if (applications.adminApi) {
    const appId = applicationId('admin')
    const realAppId = `${applications.adminApi.storeFqdn}-${appId}`
    const token = session.applications[realAppId]!
    tokensAreExpired = tokensAreExpired || isTokenExpired(token)
  }

  outputDebug(`
The validation of the token for application/identity completed with the following results:
- It's expired: ${tokensAreExpired}
- It's invalid in identity: ${!identityIsValid}
  `)

  if (tokensAreExpired) return 'needs_refresh'
  if (!identityIsValid) return 'needs_full_auth'
  return 'ok'
}

function isTokenExpired(token: ApplicationToken): boolean {
  if (!token) return true
  return token.expiresAt < expireThreshold()
}

function expireThreshold(): Date {
  return new Date(Date.now() + sessionConstants.expirationTimeMarginInMinutes * 60 * 1000)
}
