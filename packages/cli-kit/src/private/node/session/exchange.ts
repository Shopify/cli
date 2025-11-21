import {ApplicationToken, IdentityToken} from './schema.js'
import {tokenExchangeScopes} from './scopes.js'
import {buildIdentityToken, buildApplicationToken, tokenRequestErrorHandler} from './token-utils.js'
import {API} from '../api.js'
import {err, ok, Result} from '../../../public/node/result.js'
import {AbortError} from '../../../public/node/error.js'
import {setLastSeenAuthMethod, setLastSeenUserIdAfterAuth} from '../session.js'
import {nonRandomUUID} from '../../../public/node/crypto.js'
import {getIdentityClient} from '../clients/identity/instance.js'
import {outputContent, outputDebug} from '../../../public/node/output.js'

export {InvalidGrantError, InvalidRequestError} from './token-utils.js'

export interface ExchangeScopes {
  admin: string[]
  partners: string[]
  storefront: string[]
  businessPlatform: string[]
  appManagement: string[]
}

/**
 * Request an identity token using the device authorization flow.
 * This initiates the full flow: request device code, show to user, and poll for completion.
 * @param scopes - The scopes to request
 * @returns An identity token
 */
export async function requestAccessToken(scopes: string[]): Promise<IdentityToken> {
  const identityClient = getIdentityClient()
  outputDebug(outputContent`Requesting device authorization code...`)
  const deviceAuth = await identityClient.requestDeviceAuthorization(scopes)

  outputDebug(outputContent`Starting polling for the identity token...`)
  const identityToken = await pollForDeviceAuthorization(deviceAuth.deviceCode, deviceAuth.interval)
  return identityToken
}

/**
 * Poll the Oauth token endpoint with the device code obtained from a DeviceAuthorizationResponse.
 * The endpoint will return `authorization_pending` until the user completes the auth flow in the browser.
 * Once the user completes the auth flow, the endpoint will return the identity token.
 *
 * @param code - The device code obtained after starting a device identity flow
 * @param interval - The interval to poll the token endpoint
 * @returns The identity token
 */
async function pollForDeviceAuthorization(code: string, interval = 5): Promise<IdentityToken> {
  let currentIntervalInSeconds = interval

  return new Promise<IdentityToken>((resolve, reject) => {
    const onPoll = async () => {
      const result = await exchangeDeviceCodeForAccessToken(code)
      if (!result.isErr()) {
        resolve(result.value)
        return
      }

      const error = result.error ?? 'unknown_failure'

      outputDebug(outputContent`Polling for device authorization... status: ${error}`)
      switch (error) {
        case 'authorization_pending': {
          startPolling()
          return
        }
        case 'slow_down':
          currentIntervalInSeconds += 5
          startPolling()
          return
        case 'access_denied':
        case 'expired_token':
        case 'unknown_failure': {
          reject(new Error(`Device authorization failed: ${error}`))
        }
      }
    }

    const startPolling = () => {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(onPoll, currentIntervalInSeconds * 1000)
    }

    startPolling()
  })
}

/**
 * Given an identity token, request an application token.
 * @param identityToken - access token obtained in a previous step
 * @param store - the store to use, only needed for admin API
 * @returns An array with the application access tokens.
 */
export async function exchangeAccessForApplicationTokens(
  identityToken: IdentityToken,
  scopes: ExchangeScopes,
  store?: string,
): Promise<{[x: string]: ApplicationToken}> {
  const token = identityToken.accessToken

  const [partners, storefront, businessPlatform, admin, appManagement] = await Promise.all([
    requestAppToken('partners', token, scopes.partners),
    requestAppToken('storefront-renderer', token, scopes.storefront),
    requestAppToken('business-platform', token, scopes.businessPlatform),
    store ? requestAppToken('admin', token, scopes.admin, store) : {},
    requestAppToken('app-management', token, scopes.appManagement),
  ])

  return {
    ...partners,
    ...storefront,
    ...businessPlatform,
    ...admin,
    ...appManagement,
  }
}

export async function refreshAccessToken(currentToken: IdentityToken): Promise<IdentityToken> {
  const clientId = getIdentityClient().clientId()
  const params = {
    grant_type: 'refresh_token',
    access_token: currentToken.accessToken,
    refresh_token: currentToken.refreshToken,
    client_id: clientId,
  }
  const tokenResult = await getIdentityClient().tokenRequest(params)
  const value = tokenResult.mapError(tokenRequestErrorHandler).valueOrBug()
  return buildIdentityToken(value, currentToken.userId, currentToken.alias)
}

/**
 * Given a custom CLI token passed as ENV variable  request a valid API access token
 * @param token - The CLI token passed as ENV variable `SHOPIFY_CLI_PARTNERS_TOKEN`
 * @param apiName - The API to exchange for the access token
 * @param scopes - The scopes to request with the access token
 * @returns An instance with the application access tokens.
 */
async function exchangeCliTokenForAccessToken(
  apiName: API,
  token: string,
  scopes: string[],
): Promise<{accessToken: string; userId: string}> {
  const appId = getIdentityClient().applicationId(apiName)
  try {
    const newToken = await requestAppToken(apiName, token, scopes)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const accessToken = newToken[appId]!.accessToken
    const userId = nonRandomUUID(token)
    setLastSeenUserIdAfterAuth(userId)
    setLastSeenAuthMethod('partners_token')
    return {accessToken, userId}
  } catch (error) {
    const prettyName = apiName.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    throw new AbortError(
      `The custom token provided can't be used for the ${prettyName} API.`,
      'Ensure the token is correct and not expired.',
    )
  }
}

/**
 * Given a custom CLI token passed as ENV variable, request a valid Partners API token
 * This token does not accept extra scopes, just the cli one.
 * @param token - The CLI token passed as ENV variable `SHOPIFY_CLI_PARTNERS_TOKEN`
 * @returns An instance with the application access tokens.
 */
export async function exchangeCustomPartnerToken(token: string): Promise<{accessToken: string; userId: string}> {
  return exchangeCliTokenForAccessToken('partners', token, tokenExchangeScopes('partners'))
}

/**
 * Given a custom CLI token passed as ENV variable, request a valid App Management API token
 * @param token - The CLI token passed as ENV variable `SHOPIFY_CLI_PARTNERS_TOKEN`
 * @returns An instance with the application access tokens.
 */
export async function exchangeCliTokenForAppManagementAccessToken(
  token: string,
): Promise<{accessToken: string; userId: string}> {
  return exchangeCliTokenForAccessToken('app-management', token, tokenExchangeScopes('app-management'))
}

/**
 * Given a custom CLI token passed as ENV variable, request a valid Business Platform API token
 * @param token - The CLI token passed as ENV variable `SHOPIFY_CLI_PARTNERS_TOKEN`
 * @returns An instance with the application access tokens.
 */
export async function exchangeCliTokenForBusinessPlatformAccessToken(
  token: string,
): Promise<{accessToken: string; userId: string}> {
  return exchangeCliTokenForAccessToken('business-platform', token, tokenExchangeScopes('business-platform'))
}

type IdentityDeviceError = 'authorization_pending' | 'access_denied' | 'expired_token' | 'slow_down' | 'unknown_failure'

/**
 * Given a deviceCode obtained after starting a device identity flow, request an identity token.
 * @param deviceCode - The device code obtained after starting a device identity flow
 * @param scopes - The scopes to request
 * @returns An instance with the identity access tokens.
 */
async function exchangeDeviceCodeForAccessToken(
  deviceCode: string,
): Promise<Result<IdentityToken, IdentityDeviceError>> {
  const clientId = getIdentityClient().clientId()

  const params = {
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCode,
    client_id: clientId,
  }

  const tokenResult = await getIdentityClient().tokenRequest(params)
  if (tokenResult.isErr()) {
    return err(tokenResult.error.error as IdentityDeviceError)
  }
  const identityToken = buildIdentityToken(tokenResult.value)
  return ok(identityToken)
}

export async function requestAppToken(
  api: API,
  token: string,
  scopes: string[] = [],
  store?: string,
): Promise<{[x: string]: ApplicationToken}> {
  const identityClient = getIdentityClient()
  const appId = identityClient.applicationId(api)

  const params = {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    client_id: identityClient.clientId(),
    audience: appId,
    scope: scopes.join(' '),
    subject_token: token,
    ...(api === 'admin' && {destination: `https://${store}/admin`, store}),
  }

  let identifier = appId
  if (api === 'admin' && store) {
    identifier = `${store}-${appId}`
  }
  const tokenResult = await getIdentityClient().tokenRequest(params)
  const value = tokenResult.mapError(tokenRequestErrorHandler).valueOrBug()
  const appToken = buildApplicationToken(value)
  return {[identifier]: appToken}
}
