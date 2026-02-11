/**
 * IdentityClient wraps the existing exchange and device-authorization functions
 * into a cohesive interface for talking to accounts.shopify.com.
 *
 * The SessionCoordinator consumes this interface. Consumers never call
 * IdentityClient directly.
 */

import {
  exchangeAccessForApplicationTokens,
  exchangeCustomPartnerToken,
  exchangeCliTokenForAppManagementAccessToken,
  exchangeCliTokenForBusinessPlatformAccessToken,
  refreshAccessToken,
  ExchangeScopes,
} from '../../../../private/node/session/exchange.js'
import {
  requestDeviceAuthorization,
  pollForDeviceAuthorization,
  DeviceAuthorizationResponse,
} from '../../../../private/node/session/device-authorization.js'
import {IdentityToken, ApplicationToken} from '../../../../private/node/session/schema.js'

import type {ApiAudience} from './credential-provider.js'

export type {DeviceAuthorizationResponse} from '../../../../private/node/session/device-authorization.js'
export type {IdentityToken, ApplicationToken} from '../../../../private/node/session/schema.js'
export type {ExchangeScopes} from '../../../../private/node/session/exchange.js'

export interface ExchangeAllOpts {
  scopes: ExchangeScopes
  storeFqdn?: string
}

/**
 * HTTP-level client for accounts.shopify.com identity service.
 * Uses shopifyFetch() internally, unchanged from today.
 */
export interface IdentityClient {
  /** Start a device authorization flow. */
  initiateDeviceAuth(scopes: string[]): Promise<DeviceAuthorizationResponse>

  /** Poll for device auth approval, resolving once the user approves. */
  pollForDeviceApproval(deviceCode: string, intervalMs?: number): Promise<IdentityToken>

  /** Exchange an identity token for application tokens. */
  exchangeAllTokens(identity: IdentityToken, opts: ExchangeAllOpts): Promise<{[key: string]: ApplicationToken}>

  /** Refresh an expired identity token using its refresh token. */
  refreshIdentityToken(currentToken: IdentityToken): Promise<IdentityToken>

  /**
   * Exchange a custom CLI token (SHOPIFY_CLI_PARTNERS_TOKEN) for an API-specific token.
   *
   * @throws For unsupported audiences (admin, storefront-renderer).
   */
  exchangeCustomToken(token: string, audience: ApiAudience): Promise<{accessToken: string; userId: string}>
}

/**
 * Creates an IdentityClient that delegates to the existing exchange.ts
 * and device-authorization.ts functions. No logic moved, only wrapped.
 *
 * @returns An IdentityClient instance.
 */
export function createIdentityClient(): IdentityClient {
  return {
    async initiateDeviceAuth(scopes: string[]): Promise<DeviceAuthorizationResponse> {
      return requestDeviceAuthorization(scopes)
    },

    async pollForDeviceApproval(deviceCode: string, intervalMs?: number): Promise<IdentityToken> {
      return pollForDeviceAuthorization(deviceCode, intervalMs)
    },

    async exchangeAllTokens(
      identity: IdentityToken,
      opts: ExchangeAllOpts,
    ): Promise<{[key: string]: ApplicationToken}> {
      return exchangeAccessForApplicationTokens(identity, opts.scopes, opts.storeFqdn)
    },

    async refreshIdentityToken(currentToken: IdentityToken): Promise<IdentityToken> {
      return refreshAccessToken(currentToken)
    },

    async exchangeCustomToken(token: string, audience: ApiAudience): Promise<{accessToken: string; userId: string}> {
      const audienceToExchanger: {
        [key in ApiAudience]?: (tk: string) => Promise<{accessToken: string; userId: string}>
      } = {
        partners: exchangeCustomPartnerToken,
        'app-management': exchangeCliTokenForAppManagementAccessToken,
        'business-platform': exchangeCliTokenForBusinessPlatformAccessToken,
      }

      const exchanger = audienceToExchanger[audience]
      if (!exchanger) {
        throw new Error(
          `Custom CLI token exchange is not supported for audience '${audience}'. ` +
            `Supported audiences: partners, app-management, business-platform.`,
        )
      }
      return exchanger(token)
    },
  }
}
