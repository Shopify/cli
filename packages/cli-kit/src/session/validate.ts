import constants from '../constants'
import {OAuthApplications} from '../session'

import {applicationId} from './identity'
import {ApplicationToken, IdentityToken} from './schema'

/**
 * Validate if an identity token is valid for the requested scopes
 * @param requestedScopes scopes
 * @param identity
 * @returns
 */
export function validateScopes(requestedScopes: string[], identity: IdentityToken) {
  const currentScopes = identity.scopes
  return requestedScopes.every((scope) => currentScopes.includes(scope))
}

export function validateSession(
  applications: OAuthApplications,
  session: {
    identity: IdentityToken
    applications: {[x: string]: ApplicationToken}
  },
) {
  if (!session) return false
  let tokensAreValid = validateToken(session.identity)
  if (applications.partnersApi) {
    // make sure partners works
    const appId = applicationId('partners')
    const token = session.applications[appId]
    tokensAreValid &&= validateToken(token)
  }

  if (applications.storefrontRendererApi) {
    const appId = applicationId('storefront-renderer')
    const token = session.applications[appId]
    tokensAreValid &&= validateToken(token)
  }

  if (applications.adminApi) {
    const appId = applicationId('admin')
    const realAppId = `${applications.adminApi.storeFqdn}-${appId}`
    const token = session.applications[realAppId]
    tokensAreValid &&= validateToken(token)
  }
  return tokensAreValid
}

function validateToken(token: ApplicationToken): boolean {
  if (!token) return false
  return token.expiresAt > expireThreshold()
}

function expireThreshold(): Date {
  return new Date(Date.now() + constants.session.expirationTimeMarginInMinutes * 60 * 1000)
}
