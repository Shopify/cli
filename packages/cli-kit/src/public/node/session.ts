import {shopifyFetch} from './http.js'
import {nonRandomUUID} from './crypto.js'
import {getAppAutomationToken} from './environment.js'
import {identityFqdn} from './context/fqdn.js'
import {firstPartyDev} from './context/local.js'
import {AbortError, BugError} from './error.js'
import {outputContent, outputToken, outputDebug} from './output.js'
import {
  clearPendingDeviceAuth,
  getCurrentSessionId,
  getPendingDeviceAuth,
  setCurrentSessionId,
  setPendingDeviceAuth,
} from '../../private/node/conf-store.js'
import * as sessionStore from '../../private/node/session/store.js'
import {allDefaultScopes} from '../../private/node/session/scopes.js'
import {validateSession} from '../../private/node/session/validate.js'
import {
  exchangeDeviceCodeForAccessToken,
  exchangeCustomPartnerToken,
  exchangeAppAutomationTokenForAppManagementAccessToken,
  exchangeAppAutomationTokenForBusinessPlatformAccessToken,
} from '../../private/node/session/exchange.js'
import {
  AdminAPIScope,
  AppManagementAPIScope,
  BusinessPlatformScope,
  completeAuthFlow,
  EnsureAuthenticatedAdditionalOptions,
  PartnersAPIScope,
  StorefrontRendererScope,
  ensureAuthenticated,
  setLastSeenAuthMethod,
  setLastSeenUserIdAfterAuth,
} from '../../private/node/session.js'
import {requestDeviceAuthorization} from '../../private/node/session/device-authorization.js'
import {isThemeAccessSession} from '../../private/node/api/rest.js'

/**
 * Session Object to access the Admin API, includes the token and the store FQDN.
 */
export interface AdminSession {
  token: string
  storeFqdn: string
}

/**
 * Session Object for Partners API and App Management API access.
 */
export interface Session {
  token: string
  businessPlatformToken: string
  accountInfo: AccountInfo
  userId: string
}

export type AccountInfo = UserAccountInfo | ServiceAccountInfo | UnknownAccountInfo

/**
 * Records the user ID that should be attached to command analytics for this process.
 *
 * @param userId - User identifier to report on the command analytics event.
 */
export function setLastSeenUserId(userId: string): void {
  setLastSeenUserIdAfterAuth(userId)
}

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

export type AuthStatusName = 'authenticated' | 'needs_refresh' | 'not_authenticated' | 'invalid'

export interface AuthStatus {
  status: AuthStatusName
  authenticated: boolean
  account?: {
    userId: string
    alias?: string
  }
  identityFqdn?: string
  expiresAt?: string
  agentGuidance: {
    instruction: string
    nextCommand?: string
  }
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

function authStatusGuidance(status: AuthStatusName): AuthStatus['agentGuidance'] {
  if (status === 'authenticated') {
    return {instruction: 'A Shopify CLI session is available. Continue with the requested Shopify CLI command.'}
  }

  if (status === 'needs_refresh') {
    return {
      instruction:
        'A Shopify CLI session is available, but it may refresh before the next command. Continue with the requested Shopify CLI command.',
    }
  }

  return {
    instruction:
      'No usable Shopify CLI session is available. Run `shopify auth login`, show the verification URL and user code to the user, and then run `shopify auth login --resume` after the user authorizes.',
    nextCommand: 'shopify auth login',
  }
}

function validationResultToAuthStatus(validationResult: Awaited<ReturnType<typeof validateSession>>): AuthStatusName {
  if (validationResult === 'ok') return 'authenticated'
  if (validationResult === 'needs_refresh') return 'needs_refresh'
  return 'invalid'
}

/**
 * Returns the current Shopify CLI authentication status without starting a login flow.
 *
 * @returns The current authentication status.
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  const fqdn = await identityFqdn()
  const sessions = await sessionStore.fetch()
  const fqdnSessions = sessions?.[fqdn] ?? {}
  const currentSessionId = getCurrentSessionId()
  const sessionId = currentSessionId ?? Object.keys(fqdnSessions)[0]

  if (!sessionId) {
    return {
      status: 'not_authenticated',
      authenticated: false,
      identityFqdn: fqdn,
      agentGuidance: authStatusGuidance('not_authenticated'),
    }
  }

  const session = fqdnSessions[sessionId]
  if (!session) {
    return {
      status: 'invalid',
      authenticated: false,
      identityFqdn: fqdn,
      agentGuidance: authStatusGuidance('invalid'),
    }
  }

  const validationResult = await validateSession(allDefaultScopes(), {}, session)
  const status = validationResultToAuthStatus(validationResult)

  return {
    status,
    authenticated: status !== 'invalid',
    account: {
      userId: session.identity.userId,
      alias: session.identity.alias,
    },
    identityFqdn: fqdn,
    expiresAt: session.identity.expiresAt.toISOString(),
    agentGuidance: authStatusGuidance(status),
  }
}

/**
 * Ensure that we have a valid session with no particular scopes.
 *
 * @param env - Optional environment variables to use.
 * @param options - Optional extra options to use.
 * @returns The user ID.
 */
export async function ensureAuthenticatedUser(
  env = process.env,
  options: EnsureAuthenticatedAdditionalOptions = {},
): Promise<{userId: string}> {
  outputDebug(outputContent`Ensuring that the user is authenticated with no particular scopes`)
  const tokens = await ensureAuthenticated({}, env, options)
  return {userId: tokens.userId}
}

/**
 * Ensure that we have a valid session to access the Partners API.
 * If SHOPIFY_CLI_PARTNERS_TOKEN exists, that token will be used to obtain a valid Partners Token
 * If SHOPIFY_CLI_PARTNERS_TOKEN exists, scopes will be ignored.
 *
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @param env - Optional environment variables to use.
 * @param options - Optional extra options to use.
 * @returns The access token for the Partners API.
 */
export async function ensureAuthenticatedPartners(
  scopes: PartnersAPIScope[] = [],
  env = process.env,
  options: EnsureAuthenticatedAdditionalOptions = {},
): Promise<{token: string; userId: string}> {
  outputDebug(outputContent`Ensuring that the user is authenticated with the Partners API with the following scopes:
${outputToken.json(scopes)}
`)
  const envToken = getAppAutomationToken()
  if (envToken) {
    const result = await exchangeCustomPartnerToken(envToken)
    return {token: result.accessToken, userId: result.userId}
  }
  const tokens = await ensureAuthenticated({partnersApi: {scopes}}, env, options)
  if (!tokens.partners) {
    throw new BugError('No partners token found after ensuring authenticated')
  }
  return {token: tokens.partners, userId: tokens.userId}
}

/**
 * Ensure that we have a valid session to access the App Management API.
 *
 * @param options - Optional extra options to use.
 * @param appManagementScopes - Optional array of extra scopes to authenticate with.
 * @param businessPlatformScopes - Optional array of extra scopes to authenticate with.
 * @param env - Optional environment variables to use.
 * @returns The access token for the App Management API.
 */
export async function ensureAuthenticatedAppManagementAndBusinessPlatform(
  options: EnsureAuthenticatedAdditionalOptions = {},
  appManagementScopes: AppManagementAPIScope[] = [],
  businessPlatformScopes: BusinessPlatformScope[] = [],
  env = process.env,
): Promise<{appManagementToken: string; userId: string; businessPlatformToken: string}> {
  outputDebug(outputContent`Ensuring that the user is authenticated with the App Management API with the following scopes:
${outputToken.json(appManagementScopes)}
`)

  const envToken = getAppAutomationToken()
  if (envToken) {
    const appManagmentToken = await exchangeAppAutomationTokenForAppManagementAccessToken(envToken)
    const businessPlatformToken = await exchangeAppAutomationTokenForBusinessPlatformAccessToken(envToken)

    return {
      appManagementToken: appManagmentToken.accessToken,
      userId: appManagmentToken.userId,
      businessPlatformToken: businessPlatformToken.accessToken,
    }
  }

  const tokens = await ensureAuthenticated(
    {appManagementApi: {scopes: appManagementScopes}, businessPlatformApi: {scopes: businessPlatformScopes}},
    env,
    options,
  )
  if (!tokens.appManagement || !tokens.businessPlatform) {
    throw new BugError('No App Management or Business Platform token found after ensuring authenticated')
  }

  return {
    appManagementToken: tokens.appManagement,
    userId: tokens.userId,
    businessPlatformToken: tokens.businessPlatform,
  }
}

/**
 * Ensure that we have a valid session to access the Storefront API.
 *
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @param password - Optional password to use.
 * @param options - Optional extra options to use.
 * @returns The access token for the Storefront API.
 */
export async function ensureAuthenticatedStorefront(
  scopes: StorefrontRendererScope[] = [],
  password: string | undefined = undefined,
  options: EnsureAuthenticatedAdditionalOptions = {},
): Promise<string> {
  if (password) {
    const session = {token: password, storeFqdn: ''}
    const authMethod = isThemeAccessSession(session) ? 'theme_access_token' : 'custom_app_token'
    setLastSeenAuthMethod(authMethod)
    setLastSeenUserIdAfterAuth(nonRandomUUID(password))
    return password
  }

  outputDebug(outputContent`Ensuring that the user is authenticated with the Storefront API with the following scopes:
${outputToken.json(scopes)}
`)
  const tokens = await ensureAuthenticated({storefrontRendererApi: {scopes}}, process.env, options)
  if (!tokens.storefront) {
    throw new BugError('No storefront token found after ensuring authenticated')
  }
  return tokens.storefront
}

/**
 * Ensure that we have a valid Admin session for the given store.
 *
 * @param store - Store fqdn to request auth for.
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @param options - Optional extra options to use.
 * @returns The access token for the Admin API.
 */
export async function ensureAuthenticatedAdmin(
  store: string,
  scopes: AdminAPIScope[] = [],
  options: EnsureAuthenticatedAdditionalOptions = {},
): Promise<AdminSession> {
  outputDebug(outputContent`Ensuring that the user is authenticated with the Admin API with the following scopes for the store ${outputToken.raw(
    store,
  )}:
${outputToken.json(scopes)}
`)
  const tokens = await ensureAuthenticated({adminApi: {scopes, storeFqdn: store}}, process.env, {
    ...options,
  })
  if (!tokens.admin) {
    throw new BugError('No admin token found after ensuring authenticated')
  }
  return tokens.admin
}

/**
 * Ensure that we have a valid session to access the Theme API.
 * If a password is provided, that token will be used against Theme Access API.
 * Otherwise, it will ensure that the user is authenticated with the Admin API.
 *
 * @param store - Store fqdn to request auth for.
 * @param password - Password generated from Theme Access app.
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @param options - Optional extra options to use.
 * @returns The access token and store.
 */
export async function ensureAuthenticatedThemes(
  store: string,
  password: string | undefined,
  scopes: AdminAPIScope[] = [],
  options: EnsureAuthenticatedAdditionalOptions = {},
): Promise<AdminSession> {
  outputDebug(outputContent`Ensuring that the user is authenticated with the Theme API with the following scopes:
${outputToken.json(scopes)}
`)
  if (password) {
    const session = {token: password, storeFqdn: store}
    const authMethod = isThemeAccessSession(session) ? 'theme_access_token' : 'custom_app_token'
    setLastSeenAuthMethod(authMethod)
    setLastSeenUserIdAfterAuth(nonRandomUUID(password))
    return session
  }
  return ensureAuthenticatedAdmin(store, scopes, options)
}

/**
 * Ensure that we have a valid session to access the Business Platform API.
 *
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @returns The access token for the Business Platform API.
 */
export async function ensureAuthenticatedBusinessPlatform(scopes: BusinessPlatformScope[] = []): Promise<string> {
  outputDebug(outputContent`Ensuring that the user is authenticated with the Business Platform API with the following scopes:
${outputToken.json(scopes)}
`)
  const tokens = await ensureAuthenticated({businessPlatformApi: {scopes}}, process.env)
  if (!tokens.businessPlatform) {
    throw new BugError('No business-platform token found after ensuring authenticated')
  }
  return tokens.businessPlatform
}

/**
 * Logout from Shopify.
 *
 * @returns A promise that resolves when the logout is complete.
 */
export function logout(): Promise<void> {
  return sessionStore.remove()
}

export interface StartDeviceAuthLoginResult {
  verificationUriComplete: string
  userCode: string
  expiresAt: string
}

/**
 * Start a resumable device authorization flow for non-interactive `shopify auth login`.
 *
 * @returns Instructions needed to authorize the device code and resume login.
 */
export async function startDeviceAuthLogin(): Promise<StartDeviceAuthLoginResult> {
  const scopes = allDefaultScopes()
  if (firstPartyDev()) {
    scopes.push('employee')
  }
  const deviceAuth = await requestDeviceAuthorization(scopes, {noPrompt: true})
  const verificationUriComplete = deviceAuth.verificationUriComplete ?? deviceAuth.verificationUri
  const expiresAt = Date.now() + deviceAuth.expiresIn * 1000

  setPendingDeviceAuth({
    deviceCode: deviceAuth.deviceCode,
    userCode: deviceAuth.userCode,
    verificationUriComplete,
    interval: deviceAuth.interval ?? 5,
    expiresAt,
  })

  return {verificationUriComplete, userCode: deviceAuth.userCode, expiresAt: new Date(expiresAt).toISOString()}
}

export type ResumeDeviceAuthLoginResult =
  | {status: 'success'; alias: string}
  | {status: 'pending'; verificationUriComplete: string; userCode: string}
  | {status: 'expired'; message: string}
  | {status: 'denied'; message: string}
  | {status: 'no_pending'; message: string}

/**
 * Resume a previously started non-interactive device authorization flow.
 *
 * @returns The result of exchanging the stashed device code.
 */
export async function resumeDeviceAuthLogin(): Promise<ResumeDeviceAuthLoginResult> {
  const pending = getPendingDeviceAuth()

  if (!pending) {
    return {status: 'no_pending', message: 'No pending login flow. Run `shopify auth login` first.'}
  }

  if (Date.now() > pending.expiresAt) {
    clearPendingDeviceAuth()
    return {status: 'expired', message: 'The login flow has expired. Run `shopify auth login` again.'}
  }

  const result = await exchangeDeviceCodeForAccessToken(pending.deviceCode)

  if (result.isErr()) {
    const error = result.error
    if (error === 'authorization_pending' || error === 'slow_down') {
      return {
        status: 'pending',
        verificationUriComplete: pending.verificationUriComplete,
        userCode: pending.userCode,
      }
    }
    if (error === 'expired_token') {
      clearPendingDeviceAuth()
      return {status: 'expired', message: 'The login flow has expired. Run `shopify auth login` again.'}
    }

    clearPendingDeviceAuth()
    return {status: 'denied', message: `Authorization failed: ${error}. Run \`shopify auth login\` to try again.`}
  }

  const session = await completeAuthFlow(result.value, {})
  const fqdn = await identityFqdn()
  const sessions = (await sessionStore.fetch()) ?? {}
  const sessionId = session.identity.userId
  await sessionStore.store({
    ...sessions,
    [fqdn]: {...sessions[fqdn], [sessionId]: session},
  })
  setCurrentSessionId(sessionId)
  clearPendingDeviceAuth()

  return {status: 'success', alias: session.identity.alias ?? sessionId}
}

/**
 * Ensure that we have a valid Admin session for the given store, with access on behalf of the app.
 *
 * See `ensureAuthenticatedAdmin` for access on behalf of a user.
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

  const body = await tokenResponse.text()

  if (tokenResponse.status === 400) {
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
  try {
    const tokenJson = JSON.parse(body) as {access_token: string}
    return {token: tokenJson.access_token, storeFqdn}
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AbortError(
        `Received invalid response from admin authentication service (HTTP ${tokenResponse.status}).`,
        'The response could not be parsed as JSON. The service may be temporarily unavailable. Please try again.',
      )
    }
    throw error
  }
}
