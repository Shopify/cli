import {shopifyFetch} from './http.js'
import {nonRandomUUID} from './crypto.js'
import {getAppAutomationToken} from './environment.js'
import {AbortError, BugError} from './error.js'
import {outputCompleted, outputContent, outputDebug, outputToken} from './output.js'
import {identityFqdn} from './context/fqdn.js'
import * as sessionStore from '../../private/node/session/store.js'
import {getCurrentSessionId, setCurrentSessionId} from '../../private/node/conf-store.js'
import {
  exchangeCustomPartnerToken,
  exchangeAppAutomationTokenForAppManagementAccessToken,
  exchangeAppAutomationTokenForBusinessPlatformAccessToken,
} from '../../private/node/session/exchange.js'
import {
  AdminAPIScope,
  AppManagementAPIScope,
  BusinessPlatformScope,
  EnsureAuthenticatedAdditionalOptions,
  PartnersAPIScope,
  StorefrontRendererScope,
  ensureAuthenticated,
  setLastSeenAuthMethod,
  setLastSeenUserIdAfterAuth,
} from '../../private/node/session.js'
import {isThemeAccessSession} from '../../private/node/api/rest.js'
import {environmentVariables} from '../../private/node/constants.js'
import {applicationId} from '../../private/node/session/identity.js'
import {allDefaultScopes} from '../../private/node/session/scopes.js'
import {firstPartyDev} from './context/local.js'
import type {Session as IdentityStoredSession, Sessions} from '../../private/node/session/schema.js'

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
 * Diagnostic snapshot of the currently-active CLI session. Returned by
 * `getCurrentSessionInfo`. Intended for `shopify auth whoami` and similar
 * inspection commands; not part of the normal request-execution path.
 *
 * All token values are masked to their first 8 characters + length to avoid
 * leaking credentials into logs/screenshots, while still letting an operator
 * eyeball that a token is present and roughly which one.
 */
export interface CurrentSessionInfo {
  /** True when a Sessions row resolves to the current session id. */
  loggedIn: boolean
  /** Identity FQDN this run resolved to (e.g. `accounts.shopify.com`, `identity.shop.dev`). */
  identityFqdn: string
  /** Active session id (= bucket key in `Sessions[fqdn]`). */
  userId?: string
  /** Heuristic: `userId` looks like a UUID and matches the imported placeholder convention. */
  looksLikePlaceholder?: boolean
  /** Display alias from the identity record (typically the user email, undefined for placeholders). */
  alias?: string
  /** Number of scopes claimed by the identity token. */
  scopeCount?: number
  /** Scopes claimed by the identity token. */
  scopes?: string[]
  /** Masked preview of the identity access token + raw length. */
  identityToken?: {preview: string; length: number; expiresAt: string}
  /** Whether the identity refresh token is present + its length. */
  refreshToken?: {present: true; length: number} | {present: false}
  /** Per-audience application tokens cached for this session. */
  applications?: {
    appId: string
    preview: string
    length: number
    expiresAt: string
    storeFqdn?: string
  }[]
  /**
   * The raw, unredacted session row read from disk. Populated only when the
   * caller explicitly opts in via `getCurrentSessionInfo({raw: true})`. Use
   * sparingly — contains live access tokens and refresh tokens.
   */
  raw?: IdentityStoredSession
  /**
   * The full `Sessions` blob (all fqdns, all users) read from disk. Populated
   * only when `{raw: true}`. Useful for diagnosing why a particular session
   * is/isn't being resolved as the current one.
   */
  rawAllSessions?: Sessions
}

function maskToken(token: string | undefined): {preview: string; length: number} | undefined {
  if (!token) return undefined
  const visible = token.length <= 8 ? token : `${token.slice(0, 8)}…`
  return {preview: visible, length: token.length}
}

/**
 * Options for `getCurrentSessionInfo`.
 */
export interface GetCurrentSessionInfoOptions {
  /**
   * When true, include the raw (unredacted) session row and the full Sessions
   * blob on disk. Contains live tokens — do not log this in shared channels.
   * Intended for `shopify auth whoami --raw` and equivalent diagnostic uses.
   */
  raw?: boolean
}

/**
 * Read the currently-active CLI session from disk and return a non-secret
 * snapshot of its shape. Does NOT validate scopes, refresh expired tokens, or
 * make any network calls — it's a pure inspection of `sessionStore.fetch()`.
 *
 * Returns `{ loggedIn: false }` when there is no current session row on disk.
 *
 * @param options - Optional flags. Pass `{raw: true}` to include unredacted
 * tokens and the full Sessions blob in the returned object.
 */
export async function getCurrentSessionInfo(
  options: GetCurrentSessionInfoOptions = {},
): Promise<CurrentSessionInfo> {
  const fqdn = await identityFqdn()
  const sessions = await sessionStore.fetch()
  const currentUserId = getCurrentSessionId()
  const fqdnBucket = sessions?.[fqdn]
  const session = currentUserId ? fqdnBucket?.[currentUserId] : undefined

  if (!session) {
    return {
      loggedIn: false,
      identityFqdn: fqdn,
      ...(currentUserId ? {userId: currentUserId} : {}),
      ...(options.raw && sessions ? {rawAllSessions: sessions} : {}),
    }
  }

  // Placeholder heuristic: imported preview-store sessions use the placeholder
  // account UUID as both `identity.userId` and the bucket key, with no alias.
  // Real `auth login` sessions either store a numeric Identity user id or have
  // a fetched email alias.
  const looksLikePlaceholder = !session.identity.alias && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(currentUserId ?? '')

  return {
    loggedIn: true,
    identityFqdn: fqdn,
    userId: currentUserId,
    looksLikePlaceholder,
    ...(session.identity.alias ? {alias: session.identity.alias} : {}),
    scopeCount: session.identity.scopes.length,
    scopes: session.identity.scopes,
    identityToken: {
      ...maskToken(session.identity.accessToken)!,
      expiresAt: session.identity.expiresAt.toISOString?.() ?? String(session.identity.expiresAt),
    },
    refreshToken: session.identity.refreshToken
      ? {present: true, length: session.identity.refreshToken.length}
      : {present: false},
    applications: Object.entries(session.applications).map(([appId, app]) => ({
      appId,
      ...maskToken(app.accessToken)!,
      expiresAt: app.expiresAt.toISOString?.() ?? String(app.expiresAt),
      ...(app.storeFqdn ? {storeFqdn: app.storeFqdn} : {}),
    })),
    ...(options.raw
      ? {
          raw: session,
          ...(sessions ? {rawAllSessions: sessions} : {}),
        }
      : {}),
  }
}

/**
 * A bootstrap payload describing a backend-issued Identity OAuth session that
 * the CLI should adopt as if `auth login` had just succeeded.
 *
 * Used by `importIdentitySession` to make `preview create` (and similar
 * server-driven account-provisioning flows) leave the CLI authenticated with
 * a real `IdentityToken` + `refreshToken` + per-application tokens, persisted
 * under the standard `Sessions[identityFqdn][userId]` storage.
 */
export interface IdentitySessionBootstrap {
  /** Identity access token (`shpat_...`-style or Identity-issued). Required. */
  accessToken: string
  /** Identity refresh token. Required. */
  refreshToken: string
  /** When the `accessToken` is expected to expire. Required. */
  expiresAt: Date
  /**
   * The Identity-side user id this session represents. Optional; when omitted,
   * a deterministic UUID derived from `accessToken` is used. For placeholder
   * accounts the backend should pass the placeholder UUID directly so the
   * resulting bucket lines up with `ResourceOwner` rows on the server.
   */
  userId?: string
  /**
   * Per-shop Admin API tokens to cache alongside the Identity session.
   *
   * The Admin API only accepts shop-app tokens (`shpat_*`), not Identity-issued
   * OAuth access tokens. The bootstrap's `accessToken` above is the Identity
   * OAuth token — valid for Identity-fronted APIs (partners / BP / storefront-
   * renderer / app-management) but rejected by the Admin API with
   * `[API] Service is not valid for authentication`. To make
   * `ensureAuthenticatedAdmin(storeFqdn)` resolve to a working token, callers
   * must pass the per-shop `shpat_*` token here (e.g. the value of
   * `store_auth_bootstrap.access_token` from a preview-store create response).
   *
   * Each entry's key should be the same domain the user will type as `--store`
   * (e.g. `preview-X.dev-api.shop.dev` on the rig, where `.my.shop.dev` isn't
   * routable). The token is seeded into `applications[`${storeFqdn}-${adminAppId}`]`
   * with a 1-year expiry; that's the exact key `tokensFor` looks up when an
   * Admin API call requests `storeFqdn`. Omit when the bootstrap isn't per-shop.
   */
  adminStoreTokens?: Record<string, string>
}

/**
 * Adopt a backend-issued Identity OAuth session as the active CLI account.
 *
 * Writes the bootstrap tokens directly into the `Sessions[identityFqdn][userId]`
 * storage and marks the row as the current session. To satisfy `validateSession`
 * without triggering the device-auth re-prompt or the multi-audience token
 * exchange, the import pre-seeds:
 *
 *   - `identity.scopes`: the union of all default CLI scopes (plus `employee`
 *     when running as a first-party dev). The placeholder's effective scopes
 *     are opaque to the CLI; we claim coverage so `validateScopes` returns true
 *     and the cached session is used verbatim.
 *   - `applications`: the same bootstrap accessToken aliased under every
 *     standard appId (`admin`, `partners`, `business-platform`,
 *     `storefront-renderer`, `app-management`). The placeholder bootstrap is
 *     usable directly against the audiences the backend authorized for it
 *     (typically Admin + Business Platform); aliasing it lets
 *     `ensureAuthenticatedBusinessPlatform` / `ensureAuthenticatedAdmin` read
 *     it straight out of the cache without re-running the exchange. APIs that
 *     the bootstrap is not authorized for will reject the request with a
 *     clean 401/403 at the call site — better than a mid-import re-auth loop.
 *
 * The caller is expected to have already obtained a valid Identity refresh
 * token from a trusted backend path (e.g. `POST /services/preview-stores`).
 * No browser, no device-code prompt, no consent UI.
 *
 * @param bootstrap - Backend-issued Identity tokens to import.
 * @returns The userId under which the session was persisted.
 */
export async function importIdentitySession(
  bootstrap: IdentitySessionBootstrap,
): Promise<{userId: string}> {
  const fqdn = await identityFqdn()
  const userId = bootstrap.userId ?? nonRandomUUID(bootstrap.accessToken)

  // Pre-seed scopes so `validateScopes` always returns true for any default
  // CLI command. `employee` is included conditionally because `validateScopes`
  // requires the firstPartyDev flag and the `employee` scope to track each
  // other (`firstPartyDev() !== currentScopes.includes('employee')` fails the
  // check otherwise).
  const scopes = allDefaultScopes(firstPartyDev() ? ['employee'] : [])

  // Build the `applications` map. Two distinct token shapes flow in here and
  // they're not interchangeable:
  //
  //   - Identity OAuth tokens (`atkn_2.CvMB...`, what the backend mints via
  //     `OAuth::PublicClientAccessToken.from_refresh_token`). These work
  //     against APIs that accept Identity-issued audience tokens — BP,
  //     partners, storefront-renderer, app-management. They do NOT work
  //     against the Admin API, which only accepts shop-app tokens (the
  //     `shpat_*` format minted by `Apps::Installations::EnsureInstalled`).
  //   - Shop-app Admin tokens (`shpat_*`, from the per-shop install). These
  //     are per-shop. The CLI gets one per preview shop via
  //     `store_auth_bootstrap.access_token`.
  //
  // `tokensFor` reads non-admin audiences from the bare `applicationId(api)`
  // key and admin from the store-prefixed `${storeFqdn}-${adminAppId}` key.
  // We seed each with the right token shape.
  const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  const identityScopedToken = {accessToken: bootstrap.accessToken, expiresAt: farFuture, scopes}
  const adminAppId = applicationId('admin')
  const storeScopedAdminEntries = Object.fromEntries(
    Object.entries(bootstrap.adminStoreTokens ?? {}).map(([storeFqdn, shpatToken]) => [
      `${storeFqdn}-${adminAppId}`,
      {accessToken: shpatToken, expiresAt: farFuture, scopes},
    ]),
  )
  const applications: IdentityStoredSession['applications'] = {
    [applicationId('partners')]: identityScopedToken,
    [applicationId('business-platform')]: identityScopedToken,
    [applicationId('storefront-renderer')]: identityScopedToken,
    [applicationId('app-management')]: identityScopedToken,
    ...storeScopedAdminEntries,
  }

  const newSession: IdentityStoredSession = {
    identity: {
      accessToken: bootstrap.accessToken,
      refreshToken: bootstrap.refreshToken,
      expiresAt: bootstrap.expiresAt,
      scopes,
      userId,
      // `alias` is intentionally undefined — `fetchEmail` would require a
      // working business-platform API call and the placeholder has no
      // human-meaningful email anyway. Downstream renderers should fall back
      // to the userId.
      alias: undefined,
    },
    applications,
  }

  // Merge into existing sessions rather than clobbering: a developer may already
  // have a real user logged in, and importing a placeholder session should be
  // additive (the bucket key is the placeholder's userId, distinct from the
  // real user's). `setCurrentSessionId` then flips the active selector to the
  // imported session so subsequent commands resolve to it by default.
  const existing = (await sessionStore.fetch()) ?? ({} as Sessions)
  const updated: Sessions = {
    ...existing,
    [fqdn]: {...existing[fqdn], [userId]: newSession},
  }
  await sessionStore.store(updated)
  setCurrentSessionId(userId)
  setLastSeenAuthMethod('device_auth')
  setLastSeenUserIdAfterAuth(userId)

  outputDebug(
    outputContent`Imported backend-issued Identity session for user ${outputToken.raw(userId)} (fqdn: ${outputToken.raw(
      fqdn,
    )}).`,
  )
  outputCompleted(`Identity session imported.`)

  return {userId}
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
