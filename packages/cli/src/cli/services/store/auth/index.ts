import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputCompleted, outputContent, outputDebug, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {openURL} from '@shopify/cli-kit/node/system'
import {STORE_AUTH_APP_CLIENT_ID} from './config.js'
import {setStoredStoreAppSession} from './session-store.js'
import {exchangeStoreAuthCodeForToken} from './token-client.js'
import {waitForStoreAuthCode} from './callback.js'
import {createPkceBootstrap} from './pkce.js'
import {mergeRequestedAndStoredScopes, parseStoreAuthScopes, resolveGrantedScopes} from './scopes.js'
import {resolveExistingStoreAuthScopes, type ResolvedStoreAuthScopes} from './existing-scopes.js'

interface StoreAuthInput {
  store: string
  scopes: string
}

interface StoreAuthPresenter {
  openingBrowser: () => void
  manualAuthUrl: (authorizationUrl: string) => void
  success: (store: string, email?: string) => void
}

interface StoreAuthDependencies {
  openURL: typeof openURL
  waitForStoreAuthCode: typeof waitForStoreAuthCode
  exchangeStoreAuthCodeForToken: typeof exchangeStoreAuthCodeForToken
  resolveExistingScopes?: (store: string) => Promise<ResolvedStoreAuthScopes>
  presenter: StoreAuthPresenter
}

const defaultStoreAuthPresenter: StoreAuthPresenter = {
  openingBrowser() {
    outputInfo('Shopify CLI will open the app authorization page in your browser.')
    outputInfo('')
  },
  manualAuthUrl(authorizationUrl: string) {
    outputInfo('Browser did not open automatically. Open this URL manually:')
    outputInfo(outputContent`${outputToken.link(authorizationUrl)}`)
    outputInfo('')
  },
  success(store: string, email?: string) {
    const displayName = email ? ` as ${email}` : ''

    outputCompleted('Logged in.')
    outputCompleted(`Authenticated${displayName} against ${store}.`)
    outputInfo('')
    outputInfo('To verify that authentication worked, run:')
    outputInfo(`shopify store execute --store ${store} --query 'query { shop { name id } }'`)
  },
}

const defaultStoreAuthDependencies: StoreAuthDependencies = {
  openURL,
  waitForStoreAuthCode,
  exchangeStoreAuthCodeForToken,
  presenter: defaultStoreAuthPresenter,
}

export async function authenticateStoreWithApp(
  input: StoreAuthInput,
  dependencies: StoreAuthDependencies = defaultStoreAuthDependencies,
): Promise<void> {
  const store = normalizeStoreFqdn(input.store)
  const requestedScopes = parseStoreAuthScopes(input.scopes)
  const existingScopeResolution = await (dependencies.resolveExistingScopes ?? resolveExistingStoreAuthScopes)(store)
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
    exchangeCodeForToken: dependencies.exchangeStoreAuthCodeForToken,
  })
  const {
    authorization: {authorizationUrl},
  } = bootstrap

  dependencies.presenter.openingBrowser()

  const code = await dependencies.waitForStoreAuthCode({
    ...bootstrap.waitForAuthCodeOptions,
    onListening: async () => {
      const opened = await dependencies.openURL(authorizationUrl)
      if (!opened) dependencies.presenter.manualAuthUrl(authorizationUrl)
    },
  })
  const tokenResponse = await bootstrap.exchangeCodeForToken(code)

  const userId = tokenResponse.associated_user?.id?.toString()
  if (!userId) {
    throw new AbortError('Shopify did not return associated user information for the online access token.')
  }

  const now = Date.now()
  const expiresAt = tokenResponse.expires_in ? new Date(now + tokenResponse.expires_in * 1000).toISOString() : undefined

  setStoredStoreAppSession({
    store,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    scopes: resolveGrantedScopes(tokenResponse, validationScopes),
    acquiredAt: new Date(now).toISOString(),
    expiresAt,
    refreshTokenExpiresAt: tokenResponse.refresh_token_expires_in
      ? new Date(now + tokenResponse.refresh_token_expires_in * 1000).toISOString()
      : undefined,
    associatedUser: tokenResponse.associated_user
      ? {
          id: tokenResponse.associated_user.id,
          email: tokenResponse.associated_user.email,
          firstName: tokenResponse.associated_user.first_name,
          lastName: tokenResponse.associated_user.last_name,
          accountOwner: tokenResponse.associated_user.account_owner,
        }
      : undefined,
  })

  outputDebug(
    outputContent`Session persisted for ${outputToken.raw(store)} (user ${outputToken.raw(userId)}, expires ${outputToken.raw(expiresAt ?? 'unknown')})`,
  )

  dependencies.presenter.success(store, tokenResponse.associated_user?.email)
}
