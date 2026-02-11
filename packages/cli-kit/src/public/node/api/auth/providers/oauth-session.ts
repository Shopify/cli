/**
 * OAuthSessionProvider: the heavyweight provider that handles the full OAuth lifecycle.
 * Delegates to the proven private ensureAuthenticated() for session management.
 */

import {ensureAuthenticated, OAuthApplications} from '../../../../../private/node/session.js'

import type {CredentialProvider, ApiAudience, TokenContext} from '../credential-provider.js'

export class OAuthSessionProvider implements CredentialProvider {
  readonly name = 'OAuthSession'

  async getToken(audience: ApiAudience, context?: TokenContext): Promise<string | null> {
    const applications = this.buildApplications(audience, context)
    const result = await ensureAuthenticated(applications, undefined, {
      forceRefresh: context?.forceRefresh,
      noPrompt: context?.noPrompt,
      forceNewSession: context?.forceNewSession,
    })

    return this.extractToken(result, audience)
  }

  private buildApplications(audience: ApiAudience, context?: TokenContext): OAuthApplications {
    const scopes = context?.extraScopes ?? []
    switch (audience) {
      case 'admin':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {adminApi: {storeFqdn: context?.storeFqdn ?? '', scopes: scopes as any[]}}
      case 'partners':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {partnersApi: {scopes: scopes as any[]}}
      case 'storefront-renderer':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {storefrontRendererApi: {scopes: scopes as any[]}}
      case 'business-platform':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {businessPlatformApi: {scopes: scopes as any[]}}
      case 'app-management':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {appManagementApi: {scopes: scopes as any[]}}
    }
  }

  private extractToken(
    result: {
      admin?: {token: string}
      partners?: string
      storefront?: string
      businessPlatform?: string
      appManagement?: string
    },
    audience: ApiAudience,
  ): string | null {
    switch (audience) {
      case 'admin':
        return result.admin?.token ?? null
      case 'partners':
        return result.partners ?? null
      case 'storefront-renderer':
        return result.storefront ?? null
      case 'business-platform':
        return result.businessPlatform ?? null
      case 'app-management':
        return result.appManagement ?? null
    }
  }
}
