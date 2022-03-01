import {output} from '@shopify/cli-kit'

import {SessionSchema} from './session/schema'
import type {Session, IdentityToken} from './session/schema'
import {store as storeSession, fetch as fetchSession} from './session/store'
import {identity as getIdentityFqdn} from './environment/fqdn'
import constants from './constants'
import {fetch} from './http'
import {random as randomString} from './string'
import {open} from './system'
import {listenRedirect} from './session/redirect-listener'

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

export async function ensureAuthenticated(
  applications: OAuthApplications,
): Promise<void> {
  const expiresAtThreshold = new Date(
    new Date().getTime() +
      constants.session.expirationTimeMarginInMinutes * 60 * 1000,
  )
  const identityFqdn = await getIdentityFqdn()
  const scopes = ['openid'] // employee
  const authorizationCode = authorize(identityFqdn, '', scopes)
  output.message(`Code: ${authorizationCode}`)
}

async function authorize(
  fqdn: string,
  clientId: string,
  scopes: string[],
): Promise<string> {
  const url = `http://${fqdn}/authorize`
  const port = 3456
  const host = '127.0.0.1'
  const redirectUri = `http://${host}:${port}`
  const state = randomString()
  const params = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    client_id: clientId,
    scope: scopes.join(' '),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    redirect_uri: redirectUri,
    state,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    response_type: 'code',
  }
  open(url)
  const code = await listenRedirect(host, port)
  return code
}

async function post(
  identityFqdn: string,
  path: string,
  params: object,
): Promise<object> {
  const res = (await (
    await fetch(`https://${identityFqdn}/${path}`, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Shopify CLI ${constants.versions.cli}`,
      },
    })
  ).json()) as object
  return res
}
