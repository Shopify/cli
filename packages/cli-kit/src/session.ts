<<<<<<< HEAD:packages/cli-kit/src/session/index.ts
import {Service} from '../network/service'
=======
import {Service} from './network/service';
>>>>>>> ec7d653 (Split up @shopif/cli-kit/environment into smaller modules and add spin-related utilities):packages/cli-kit/src/session.ts

/**
 * A scope supported by the Shopify Admin API.
 */
type AdminAPIScope = 'graphql' | 'themes' | 'collaborator' | string

/**
 * It represents the options to authenticate against the Shopify Admin API.
 */
interface AdminAPIOAuthOptions {
  /** fqdn of the Shopify instance */
  fqdn: string
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
  adminApi?: AdminAPIOAuthOptions[]
  partnersApi?: PartnersAPIOAuthOptions
  storefrontRendererApi?: StorefrontRendererAPIOAuthOptions
}

/**
 * It represents an oauth token.
 */
interface OAuthToken {
  /** List of scopes the token has access to */
  scopes: string[]
  /** Expiration date */
  expiresAt: Date
  /** Access token */
  accessToken: string
}

/**
 * It represents the output object of the authentication flow.
 * This object can then be used by API clients to send authenticated requests.
 */
interface OAuthSession {
  adminApi?: {
    [key: string]: OAuthToken
  }
  partnersApi?: OAuthToken
  storefrontRendererApi?: OAuthToken
}

/**
 * This method ensures that we have a valid session to authenticate against the given applications using the provided scopes.
 * @param options {OAuthApplications} An object containing the applications we need to be authenticated with.
 * @returns {OAuthSession} An instance with the access tokens organized by application.
 */
// eslint-disable-next-line require-await
export async function ensureAuthenticated(
  applications: OAuthApplications,
): Promise<OAuthSession> {
  return {}
}
