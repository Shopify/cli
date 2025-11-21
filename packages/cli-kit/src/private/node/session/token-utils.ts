import {ApplicationToken, IdentityToken} from './schema.js'
import {TokenRequestResult} from '../clients/identity/identity-client.js'
import {AbortError, BugError, ExtendableError} from '../../../public/node/error.js'
import * as jose from 'jose'

export class InvalidGrantError extends ExtendableError {}
export class InvalidRequestError extends ExtendableError {}
class InvalidTargetError extends AbortError {}

/**
 * Handles errors returned from token requests to the identity service.
 * Maps specific error codes to appropriate error types for proper error handling.
 *
 * @param error - The error code returned from the identity service
 * @param store - Optional store name for contextual error messages
 * @returns An appropriate error instance based on the error code
 */
export function tokenRequestErrorHandler({error, store}: {error: string; store?: string}) {
  const invalidTargetErrorMessage = `You are not authorized to use the CLI to develop in the provided store${
    store ? `: ${store}` : '.'
  }`

  if (error === 'invalid_grant') {
    // There's a scenario when Identity returns "invalid_grant" when trying to refresh the token
    // using a valid refresh token. When that happens, we take the user through the authentication flow.
    return new InvalidGrantError()
  }
  if (error === 'invalid_request') {
    // There's a scenario when Identity returns "invalid_request" when exchanging an identity token.
    // This means the token is invalid. We clear the session and throw an error to let the caller know.
    return new InvalidRequestError()
  }
  if (error === 'invalid_target') {
    return new InvalidTargetError(invalidTargetErrorMessage, '', [
      'Ensure you have logged in to the store using the Shopify admin at least once.',
      'Ensure you are the store owner, or have a staff account if you are attempting to log in to a dev store.',
      'Ensure you are using the permanent store domain, not a vanity domain.',
    ])
  }
  // eslint-disable-next-line @shopify/cli/no-error-factory-functions
  return new AbortError(error)
}

/**
 * Builds an IdentityToken from a token request result.
 * Extracts the user ID from the id_token JWT if not provided.
 *
 * @param result - The token request result from the identity service
 * @param existingUserId - Optional existing user ID to preserve
 * @param existingAlias - Optional existing alias to preserve
 * @returns A complete IdentityToken with all required fields
 */
export function buildIdentityToken(
  result: TokenRequestResult,
  existingUserId?: string,
  existingAlias?: string,
): IdentityToken {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const userId = existingUserId ?? (result.id_token ? jose.decodeJwt(result.id_token).sub! : undefined)

  if (!userId) {
    throw new BugError('Error setting userId for session. No id_token or pre-existing user ID provided.')
  }

  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: new Date(Date.now() + result.expires_in * 1000),
    scopes: result.scope.split(' '),
    userId,
    alias: existingAlias,
  }
}

/**
 * Builds an ApplicationToken from a token request result.
 *
 * @param result - The token request result from the identity service
 * @returns An ApplicationToken with access token, expiration, and scopes
 */
export function buildApplicationToken(result: TokenRequestResult): ApplicationToken {
  return {
    accessToken: result.access_token,
    expiresAt: new Date(Date.now() + result.expires_in * 1000),
    scopes: result.scope.split(' '),
  }
}
