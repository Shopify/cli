import {AbortError, BugError} from './error.js'
import {shopifyFetch} from './http.js'
import {createDefaultCredentialProvider, type ApiAudience, type TokenContext} from './api/auth/credential-provider.js'
import * as sessionStore from '../../private/node/session/store.js'
import {outputContent, outputToken} from '../../public/node/output.js'
import {getLastSeenUserIdAfterAuth, getLastSeenAuthMethod} from '../../private/node/session.js'
import type {AuthMethod} from '../../private/node/session.js'

// Re-export the credential provider system
export {createDefaultCredentialProvider, chainProviders} from './api/auth/credential-provider.js'
export type {CredentialProvider, ApiAudience, TokenContext} from './api/auth/credential-provider.js'

// Re-export AuthMethod from private session
export type {AuthMethod} from '../../private/node/session.js'

/**
 * Session Object to access the Admin API, includes the token and the store FQDN.
 */
export interface AdminSession {
  token: string
  storeFqdn: string
}

export type AccountInfo = UserAccountInfo | ServiceAccountInfo | UnknownAccountInfo

interface UserAccountInfo {
  type: 'UserAccount'
  email: string
}

interface ServiceAccountInfo {
  type: 'ServiceAccount'
  orgName: string
}

interface UnknownAccountInfo {
  type: 'UnknownAccount'
}

/**
 * Type guard to check if an account is a UserAccount.
 *
 * @param account - The account to check.
 * @returns True if the account is a UserAccount.
 */
export function isUserAccount(account: AccountInfo): account is UserAccountInfo {
  return account.type === 'UserAccount'
}

/**
 * Type guard to check if an account is a ServiceAccount.
 *
 * @param account - The account to check.
 * @returns True if the account is a ServiceAccount.
 */
export function isServiceAccount(account: AccountInfo): account is ServiceAccountInfo {
  return account.type === 'ServiceAccount'
}

/**
 * Obtain a token for the given API audience using the credential provider chain.
 *
 * The chain tries providers in order:
 * 1. EnvTokenProvider — SHOPIFY_CLI_PARTNERS_TOKEN (CI/CD).
 * 2. ThemeAccessProvider — theme access passwords from context.
 * 3. OAuthSessionProvider — disk-cached OAuth session with refresh.
 *
 * @param audience - The API audience to obtain a token for.
 * @param context - Optional context (storeFqdn, password, etc.).
 * @returns The access token string.
 */
export async function getToken(audience: ApiAudience, context?: TokenContext): Promise<string> {
  const provider = createDefaultCredentialProvider()
  const token = await provider.getToken(audience, context)
  if (!token) {
    throw new BugError(`No ${audience} token obtained from credential provider chain`)
  }
  return token
}

/**
 * Get the current user ID from the most recent authentication.
 *
 * @returns The user ID string.
 */
export async function getUserId(): Promise<string> {
  return getLastSeenUserIdAfterAuth()
}

/**
 * Get the authentication method used in the most recent authentication.
 *
 * @returns The auth method.
 */
export async function getAuthMethod(): Promise<AuthMethod> {
  return getLastSeenAuthMethod()
}

/**
 * Logout from Shopify.
 *
 * @returns A promise that resolves when the logout is complete.
 */
export function logout(): Promise<void> {
  return sessionStore.remove()
}

/**
 * Ensure that we have a valid Admin session for the given store, with access on behalf of the app.
 *
 * See `getToken('admin', {storeFqdn})` for access on behalf of a user.
 *
 * @param storeFqdn - Store fqdn to request auth for.
 * @param clientId - Client ID of the app.
 * @param clientSecret - Client secret of the app.
 * @returns The access token for the Admin API.
 */
export async function ensureAuthenticatedAdminAsApp(
  storeFqdn: string,
  clientId: string,
  clientSecret: string,
): Promise<AdminSession> {
  const bodyData = {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  }
  const tokenResponse = await shopifyFetch(
    `https://${storeFqdn}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyData),
    },
    'slow-request',
  )

  if (tokenResponse.status === 400) {
    const body = await tokenResponse.text()
    if (body.includes('app_not_installed')) {
      throw new AbortError(
        outputContent`App is not installed on ${outputToken.green(
          storeFqdn,
        )}. Try running ${outputToken.genericShellCommand(`shopify app dev`)} to connect your app to the shop.`,
      )
    }
    throw new AbortError(
      `Failed to get access token for app ${clientId} on store ${storeFqdn}: ${tokenResponse.statusText}`,
    )
  }

  const tokenJson = (await tokenResponse.json()) as {access_token: string}
  return {token: tokenJson.access_token, storeFqdn}
}
