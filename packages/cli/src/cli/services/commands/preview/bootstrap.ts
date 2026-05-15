import {AbortError} from '@shopify/cli-kit/node/error'
import {importIdentitySession} from '@shopify/cli-kit/node/session'
import {importStoreAuthBootstrap} from '@shopify/store'
import type {PreviewStoreCreateResponse} from './client.js'

const MAX_BOOTSTRAP_IDENTITY_LIFETIME_SECONDS = 365 * 24 * 60 * 60

function identityBootstrapExpiresAt(expiresInSeconds: number): Date {
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0 || expiresInSeconds > MAX_BOOTSTRAP_IDENTITY_LIFETIME_SECONDS) {
    throw new AbortError('Preview store returned an invalid CLI identity bootstrap expiry.')
  }

  return new Date(Date.now() + expiresInSeconds * 1000)
}

export async function importPreviewStoreBootstrap(
  response: PreviewStoreCreateResponse,
): Promise<{identityImported: boolean; storeAuthImported: boolean}> {
  const cliIdentityBootstrap = response.cli_identity_bootstrap
  const storeAuthBootstrap = response.store_auth_bootstrap

  if (!cliIdentityBootstrap && !storeAuthBootstrap) {
    return {identityImported: false, storeAuthImported: false}
  }

  const bootstrapUserId = cliIdentityBootstrap?.user_id ?? response.placeholder_account_uuid

  let userId = bootstrapUserId
  if (cliIdentityBootstrap) {
    const importedIdentity = await importIdentitySession({
      accessToken: cliIdentityBootstrap.access_token,
      refreshToken: cliIdentityBootstrap.refresh_token,
      expiresAt: identityBootstrapExpiresAt(cliIdentityBootstrap.expires_in),
      userId: bootstrapUserId,
    })
    userId = importedIdentity.userId
  }

  if (storeAuthBootstrap) {
    importStoreAuthBootstrap({
      userId,
      bootstrap: {
        accessToken: storeAuthBootstrap.access_token,
        scopes: storeAuthBootstrap.scopes,
        apiKey: storeAuthBootstrap.api_key,
        shopDomain: storeAuthBootstrap.shop_domain,
      },
    })
  }

  return {
    identityImported: Boolean(cliIdentityBootstrap),
    storeAuthImported: Boolean(storeAuthBootstrap),
  }
}
