import {identity} from './environment/fqdn'
import {
  exchangeAccessForApplicationTokens,
  exchangeCodeForAccessToken,
} from './session/exchange'
import {authorize} from './session/authorize'
import constants from './constants'
import {Session} from './session/schema'
import * as secureStore from './session/store'

/**
 * A scope supported by the Shopify Admin API.
 */
type AdminAPIScope = 'graphql' | 'themes' | 'collaborator' | string

/**
 * It represents the options to authenticate against the Shopify Admin API.
 */
interface AdminAPIOAuthOptions {
  /** Store to request permissions for */
  storeFqdn?: string
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

/**
 * It represents the authentication requirements and
 * is the input necessary to trigger the authentication
 * flow.
 */
interface OAuthApplications {
  adminApi?: AdminAPIOAuthOptions
  storefrontRendererApi?: StorefrontRendererAPIOAuthOptions
  partnersApi?: PartnersAPIOAuthOptions
}

/**
 * This method ensures that we have a valid session to authenticate against the given applications using the provided scopes.
 * @param options {OAuthApplications} An object containing the applications we need to be authenticated with.
 * @returns {OAuthSession} An instance with the access tokens organized by application.
 */

// await ensureAuthenticated({
//   adminApi: {
//     storeFqdn: 'myshop.myshopify.com',
//     scopes: [],
//   },
//   storefrontRendererApi: {
//     scopes: [],
//   },
//   partnersApi: {
//     scopes: [],
//   },
// })

export async function ensureAuthenticated(
  applications: OAuthApplications,
): Promise<void> {
  const expiresAtThreshold = new Date(
    new Date().getTime() +
      constants.session.expirationTimeMarginInMinutes * 60 * 1000,
  )

  const fqdn = await identity()

  const scopes = [
    'openid',
    'https://api.shopify.com/auth/shop.admin.graphql',
    'https://api.shopify.com/auth/shop.admin.themes',
    'https://api.shopify.com/auth/partners.collaborator-relationships.readonly',
    'https://api.shopify.com/auth/shop.storefront-renderer.devtools',
    'https://api.shopify.com/auth/partners.app.cli.access',
  ]
  const store = 'isaacroldan.myshopify.com'

  // const session = fetch()

  const code = await authorize(scopes)
  const identityToken = await exchangeCodeForAccessToken(code)
  const result = await exchangeAccessForApplicationTokens(identityToken, store)

  console.log(result)
  // const session: Session = {
  //   [fqdn]: {
  //     identity: identityToken,
  //     applications: result,
  //   },
  // }
  // secureStore.store(session)
}
