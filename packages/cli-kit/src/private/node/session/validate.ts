import {IdentityToken, Session, validateCachedIdentityTokenStructure} from './schema.js'

import {sessionConstants} from '../constants.js'
import {firstPartyDev} from '../../../public/node/context/local.js'
import {outputDebug} from '../../../public/node/output.js'

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
 * Validate if the current session is valid or we need to refresh/re-authenticate.
 * With PCAT, only the identity token needs validation - no per-application tokens.
 * @param scopes - requested scopes to validate
 * @param session - current session with identity token
 * @returns 'ok' if the session is valid, 'needs_full_auth' if we need to re-authenticate, 'needs_refresh' if we need to refresh the session
 */
export async function validateSession(scopes: string[], session: Session | undefined): Promise<ValidationResult> {
  if (!session) return 'needs_full_auth'
  const scopesAreValid = validateScopes(scopes, session.identity)
  if (!scopesAreValid) return 'needs_full_auth'

  if (!validateCachedIdentityTokenStructure(session.identity)) {
    return 'needs_full_auth'
  }

  const expired = session.identity.expiresAt < expireThreshold()
  outputDebug(`- Token validation -> It's expired: ${expired}`)

  if (expired) return 'needs_refresh'

  return 'ok'
}

function expireThreshold(): Date {
  return new Date(Date.now() + sessionConstants.expirationTimeMarginInMinutes * 60 * 1000)
}
