import {ApplicationToken, IdentityToken, Session, validateCachedIdentityTokenStructure} from './schema.js'

import {applicationId} from './identity.js'
import {sessionConstants} from '../constants.js'
import {OAuthApplications} from '../session.js'
import {outputDebug} from '../../../public/node/output.js'
import {getArrayRejectingUndefined} from '../../../public/common/array.js'

type ValidationResult = 'needs_refresh' | 'needs_full_auth' | 'ok'

/**
 * Validate if an identity token is valid for the requested scopes
 */
function validateScopes(requestedScopes: string[], identity: IdentityToken) {
  const currentScopes = identity.scopes
  if (currentScopes.includes('employee')) return false
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
  session: Session | undefined,
): Promise<ValidationResult> {
  if (!session) return 'needs_full_auth'
  const scopesAreValid = validateScopes(scopes, session.identity)
  if (!scopesAreValid) return 'needs_full_auth'

  const requestedTokenIds = getArrayRejectingUndefined([
    applications.partnersApi ? applicationId('partners') : undefined,
    applications.appManagementApi ? applicationId('app-management') : undefined,
    applications.storefrontRendererApi ? applicationId('storefront-renderer') : undefined,
    applications.adminApi ? `${applications.adminApi.storeFqdn}-${applicationId('admin')}` : undefined,
  ])

  const tokensAreExpired =
    isTokenExpired(session.identity) ||
    requestedTokenIds.some((tokenId) => isTokenExpired(session.applications[tokenId]!))

  outputDebug(`- Token validation -> It's expired: ${tokensAreExpired}`)

  if (!validateCachedIdentityTokenStructure(session.identity)) {
    return 'needs_full_auth'
  }

  if (tokensAreExpired) return 'needs_refresh'

  return 'ok'
}

function isTokenExpired(token: ApplicationToken): boolean {
  if (!token) return true
  return token.expiresAt < expireThreshold()
}

function expireThreshold(): Date {
  return new Date(Date.now() + sessionConstants.expirationTimeMarginInMinutes * 60 * 1000)
}
