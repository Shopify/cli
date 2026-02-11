/**
 * Credential provider chain for unified token management.
 *
 * Each provider either returns a token or returns `null` to say "not me, try next".
 * Throwing means "this is my job but something went wrong".
 */

import {EnvTokenProvider} from './providers/env-token.js'
import {ThemeAccessProvider} from './providers/theme-access.js'
import {OAuthSessionProvider} from './providers/oauth-session.js'

/**
 * API audiences that tokens can be requested for.
 */
export type ApiAudience = 'admin' | 'partners' | 'storefront-renderer' | 'business-platform' | 'app-management'

/**
 * Context passed to credential providers when requesting a token.
 */
export interface TokenContext {
  /** Required for admin audience (store-scoped tokens). */
  storeFqdn?: string
  /** Additional scopes beyond defaults. */
  extraScopes?: string[]
  /** Force refresh even if cached token is valid. */
  forceRefresh?: boolean
  /** If true, throw instead of prompting for device auth. */
  noPrompt?: boolean
  /** Theme access password (shptka_* or custom app token). */
  password?: string
  /** Force a new login session (logout + re-auth). */
  forceNewSession?: boolean
}

/**
 * A credential provider that can resolve tokens for a given API audience.
 * Providers form a chain: each provider is tried in order, returning the first non-null token.
 */
export interface CredentialProvider {
  readonly name: string
  getToken(audience: ApiAudience, context?: TokenContext): Promise<string | null>
}

/**
 * Creates the default credential provider chain.
 *
 * Precedence:
 * 1. EnvTokenProvider - SHOPIFY_CLI_PARTNERS_TOKEN (CI/CD).
 * 2. ThemeAccessProvider - shptka passwords (reads password from TokenContext).
 * 3. OAuthSessionProvider - Disk-cached OAuth session with refresh.
 *
 * @returns A composite credential provider.
 */
export function createDefaultCredentialProvider(): CredentialProvider {
  return chainProviders(new EnvTokenProvider(), new ThemeAccessProvider(), new OAuthSessionProvider())
}

/**
 * Composes multiple credential providers into a single provider that tries each
 * in order, returning the first non-null token.
 *
 * @param providers - Providers to chain, tried in order.
 * @returns A composite provider.
 */
export function chainProviders(...providers: CredentialProvider[]): CredentialProvider {
  return {
    name: `Chain(${providers.map((provider) => provider.name).join(', ')})`,
    async getToken(audience: ApiAudience, context?: TokenContext): Promise<string | null> {
      for (const provider of providers) {
        // eslint-disable-next-line no-await-in-loop
        const token = await provider.getToken(audience, context)
        if (token !== null) return token
      }
      return null
    },
  }
}
