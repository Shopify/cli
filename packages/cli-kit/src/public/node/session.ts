import {BugError} from './error.js'
import {getPartnersToken} from './environment.js'
import {nonRandomUUID} from './crypto.js'
import * as sessionStore from '../../private/node/session/store.js'
import {
  exchangeCustomPartnerToken,
  exchangeCliTokenForAppManagementAccessToken,
  exchangeCliTokenForBusinessPlatformAccessToken,
} from '../../private/node/session/exchange.js'
import {outputContent, outputToken, outputDebug} from '../../public/node/output.js'
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

/**
 * Session Object to access the Admin API, includes the token and the store FQDN.
 */
export interface AdminSession {
  token: string
  storeFqdn: string
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
  const envToken = getPartnersToken()
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

  const envToken = getPartnersToken()
  if (envToken) {
    const appManagmentToken = await exchangeCliTokenForAppManagementAccessToken(envToken)
    const businessPlatformToken = await exchangeCliTokenForBusinessPlatformAccessToken(envToken)

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
