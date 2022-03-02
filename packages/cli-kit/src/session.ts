import crypto from 'crypto'

import {message as outputMessage} from './output'
import {identity as getIdentityFqdn} from './environment/fqdn'
import {clientId as getIdentityClientId} from './session/identity'
import constants from './constants'
import {Abort} from './error'
import {randomHex} from './string'
import {open} from './system'
import {listenRedirect} from './session/redirect-listener'

const MismatchStateError = new Abort(
  "The state received from the authentication doesn't match the one that initiated the authentication process.",
)
/**
 * A scope supported by the Shopify Admin API.
 */
type AdminAPIScope = 'graphql' | 'themes' | 'collaborator' | string

/**
 * It represents the options to authenticate against the Shopify Admin API.
 */
interface AdminAPIOAuthOptions {
  /** List of scopes to request permissions for */
  scopes: AdminAPIScope[]
}

/**
 * A scope supported by the Partners API.
 */
type PartnersAPIScope = 'cli' | string
interface PartnersAPIOAuthOptions {
  /** List of scopes to request permissions for */
  scopes: PartnersAPIScope[]
}

/**
 * A scope supported by the Storefront Renderer API.
 */
type StorefrontRendererScope = 'devtools' | string
interface StorefrontRendererAPIOAuthOptions {
  /** List of scopes to request permissions for */
  scopes: StorefrontRendererScope[]
}

interface ShopifyOAuthOptions {
  storeFqdn?: string
  storefrontRendererApi?: StorefrontRendererAPIOAuthOptions
  adminApi?: AdminAPIOAuthOptions
}

/**
 * It represents the authentication requirements and
 * is the input necessary to trigger the authentication
 * flow.
 */
interface OAuthApplications {
  shopify?: ShopifyOAuthOptions
  partnersApi?: PartnersAPIOAuthOptions
}

/**
 * This method ensures that we have a valid session to authenticate against the given applications using the provided scopes.
 * @param options {OAuthApplications} An object containing the applications we need to be authenticated with.
 * @returns {OAuthSession} An instance with the access tokens organized by application.
 */

await ensureAuthenticated({
  shopify: {
    storeFqdn: 'myshop.myshopify.com',
    storefrontRendererApi: {
      scopes: [],
    },
    adminApi: {
      scopes: [],
    },
  },
  partnersApi: {
    scopes: [],
  },
})

export async function ensureAuthenticated(
  applications: OAuthApplications,
): Promise<void> {
  const expiresAtThreshold = new Date(
    new Date().getTime() +
      constants.session.expirationTimeMarginInMinutes * 60 * 1000,
  )
  const identityFqdn = await getIdentityFqdn()
  const identityClientId = getIdentityClientId()
  const scopes = ['openid'] // employee
  const authorizationCode = await authorize(
    identityFqdn,
    identityClientId,
    scopes,
  )
  outputMessage(`Code: ${authorizationCode}`)
}

export async function authorize(
  fqdn: string,
  clientId: string,
  scopes: string[],
  state: string = randomHex(30),
): Promise<string> {
  let url = `http://${fqdn}/oauth/authorize`
  const port = 3456
  const host = '127.0.0.1'
  const redirectUri = `http://${host}:${port}`
  const codeVerifier = randomHex(30)
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')

  const params = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    client_id: clientId,
    scope: scopes.join(' '),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    redirect_uri: redirectUri,
    state,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    response_type: 'code',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    code_challenge_method: 'S256',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    code_challenge: codeChallenge,
  }
  url = `${url}?${new URLSearchParams(params).toString()}`
  open(url)
  const result = await listenRedirect(host, port)
  if (result.state !== state) {
    throw MismatchStateError
  }
  return result.code
}
