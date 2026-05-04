import {STORE_AUTH_APP_CLIENT_ID} from './config.js'
import {setStoredStoreAppSession} from './session-store.js'
import {exchangeStoreAuthCodeForToken} from './token-client.js'
import {waitForStoreAuthCode} from './callback.js'
import {createPkceBootstrap} from './pkce.js'
import {mergeRequestedAndStoredScopes, parseStoreAuthScopes, resolveGrantedScopes} from './scopes.js'
import {resolveExistingStoreAuthScopes, type ResolvedStoreAuthScopes} from './existing-scopes.js'
import {createStoreAuthPresenter, type StoreAuthPresenter, type StoreAuthResult} from './result.js'
import {setLastSeenUserId} from '@shopify/cli-kit/node/session'
import {openURL} from '@shopify/cli-kit/node/system'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

interface StoreAuthInput {
  store: string
  scopes: string
}

interface StoreAuthDependencies {
  openURL: typeof openURL
  waitForStoreAuthCode: typeof waitForStoreAuthCode
  exchangeStoreAuthCodeForToken: typeof exchangeStoreAuthCodeForToken
  resolveExistingScopes: (store: string) => Promise<ResolvedStoreAuthScopes>
  presenter: StoreAuthPresenter
}

const defaultStoreAuthDependencies: StoreAuthDependencies = {
  openURL,
  waitForStoreAuthCode,
  exchangeStoreAuthCodeForToken,
  resolveExistingScopes: resolveExistingStoreAuthScopes,
  presenter: createStoreAuthPresenter('text'),
}

export async function authenticateStoreWithApp(
  input: StoreAuthInput,
  dependencies: Partial<StoreAuthDependencies> = {},
): Promise<StoreAuthResult> {
  const resolvedDependencies: StoreAuthDependencies = {...defaultStoreAuthDependencies, ...dependencies}
  const store = normalizeStoreFqdn(input.store)
  const requestedScopes = parseStoreAuthScopes(input.scopes)
  const existingScopeResolution = await resolvedDependencies.resolveExistingScopes(store)
  const scopes = mergeRequestedAndStoredScopes(requestedScopes, existingScopeResolution.scopes)
  const validationScopes = existingScopeResolution.authoritative ? scopes : requestedScopes

  if (existingScopeResolution.scopes.length > 0) {
    outputDebug(
      outputContent`Merged requested scopes ${outputToken.raw(requestedScopes.join(','))} with existing scopes ${outputToken.raw(existingScopeResolution.scopes.join(','))} for ${outputToken.raw(store)}`,
    )
  }

  const bootstrap = createPkceBootstrap({
    store,
    scopes,
    exchangeCodeForToken: resolvedDependencies.exchangeStoreAuthCodeForToken,
  })
  const {
    authorization: {authorizationUrl},
  } = bootstrap

  resolvedDependencies.presenter.openingBrowser()

  const code = await resolvedDependencies.waitForStoreAuthCode({
    ...bootstrap.waitForAuthCodeOptions,
    onListening: async () => {
      const opened = await resolvedDependencies.openURL(authorizationUrl)
      if (!opened) resolvedDependencies.presenter.manualAuthUrl(authorizationUrl)
    },
  })
  const tokenResponse = await bootstrap.exchangeCodeForToken(code)

  const userId = tokenResponse.associated_user?.id?.toString()
  if (!userId) {
    throw new AbortError('Shopify did not return associated user information for the online access token.')
  }
  setLastSeenUserId(userId)

  const now = Date.now()
  const expiresAt = tokenResponse.expires_in ? new Date(now + tokenResponse.expires_in * 1000).toISOString() : undefined

  const result: StoreAuthResult = {
    store,
    userId,
    scopes: resolveGrantedScopes(tokenResponse, validationScopes),
    acquiredAt: new Date(now).toISOString(),
    expiresAt,
    refreshTokenExpiresAt: tokenResponse.refresh_token_expires_in
      ? new Date(now + tokenResponse.refresh_token_expires_in * 1000).toISOString()
      : undefined,
    hasRefreshToken: Boolean(tokenResponse.refresh_token),
    associatedUser: tokenResponse.associated_user
      ? {
          id: tokenResponse.associated_user.id,
          email: tokenResponse.associated_user.email,
          firstName: tokenResponse.associated_user.first_name,
          lastName: tokenResponse.associated_user.last_name,
          accountOwner: tokenResponse.associated_user.account_owner,
        }
      : undefined,
  }

  setStoredStoreAppSession({
    store,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    scopes: result.scopes,
    acquiredAt: result.acquiredAt,
    expiresAt,
    refreshTokenExpiresAt: result.refreshTokenExpiresAt,
    associatedUser: result.associatedUser,
  })

  outputDebug(
    outputContent`Session persisted for ${outputToken.raw(store)} (user ${outputToken.raw(userId)}, expires ${outputToken.raw(expiresAt ?? 'unknown')})`,
  )

  resolvedDependencies.presenter.success(result)
  return result
}
