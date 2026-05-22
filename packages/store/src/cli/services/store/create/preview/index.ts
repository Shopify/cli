import {
  PreviewCliIdentityBootstrap,
  PreviewStoreAuthBootstrap,
  PreviewStoreClientOptions,
  PreviewStoreCreateResponse,
  createPreviewStore,
  defaultPreviewStoreClientOptions,
} from './client.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../../auth/config.js'
import {setStoredStoreAppSession} from '../../auth/session-store.js'
import {recordStoreFqdnMetadata} from '../../attribution.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {importIdentitySession, setLastSeenUserId} from '@shopify/cli-kit/node/session'

// Cap the lifetime of an imported placeholder Identity session at one year. Beyond
// this, the bootstrap is almost certainly a mistake (or worse, a malicious response
// from a compromised orchestrator) and we'd rather refuse than persist it.
const MAX_BOOTSTRAP_IDENTITY_LIFETIME_SECONDS = 365 * 24 * 60 * 60

/**
 * Preview-store sessions are issued by Core's preview-stores orchestrator with the
 * `shopify-cli-connector-app` pre-installed against ~80 default Admin API scopes
 * (see `PreviewStores::Create::DEFAULT_DEV_INSTALL_APP_KEY` in shop/world). Core
 * does not surface the granted scope list to the CLI, so we record an empty array
 * as a sentinel: downstream consumers (`store execute`) don't validate scopes
 * against the stored list, and the recovery surface for preview sessions doesn't
 * suggest re-auth with a scopes flag.
 */
const PREVIEW_STORE_SCOPES: string[] = []

/**
 * The session store keys per-store buckets by `userId`. Preview-store sessions are
 * not tied to a real Shopify user, but they are tied to a placeholder identity, so
 * we derive a stable `userId` from the placeholder UUID and namespace it with a
 * known prefix to make it (a) non-numeric (so analytics filters can isolate it)
 * and (b) collision-free with PKCE-issued sessions, which use numeric Shopify user
 * ids.
 */
export const PLACEHOLDER_USER_ID_PREFIX = 'placeholder:'

/** Magic-link TTL fixed by Core (`PreviewStores::Create::MAGIC_LINK_TTL`). */
const MAGIC_LINK_TTL_MS = 30 * 60 * 1000

interface CreatePreviewStoreInput {
  shopName: string
  email?: string
  country?: string
  client?: Partial<PreviewStoreClientOptions>
}

export interface CreatePreviewStoreResult {
  shopId: number
  shopPermanentDomain: string
  placeholderAccountUuid: string
  adminApiToken: string
  magicLinkUrl: string
  magicLinkExpiresAt: string
  /**
   * The synthetic `placeholder:<uuid>` user id under which the store-auth
   * bucket was persisted. Always present.
   */
  userId: string
  /**
   * Whether the orchestrator's `cli_identity_bootstrap` was successfully
   * imported into the standard `Sessions[identityFqdn][<uuid>]` storage,
   * making the placeholder the active CLI account for Identity-backed
   * commands. False when no bootstrap was returned, or when the import
   * itself failed (the store-auth bucket is still persisted in that case).
   */
  identityImported: boolean
  /**
   * The Identity-side userId under which the imported session was keyed.
   * Present only when `identityImported` is true.
   */
  identityUserId?: string
}

export function placeholderUserId(placeholderAccountUuid: string): string {
  return `${PLACEHOLDER_USER_ID_PREFIX}${placeholderAccountUuid}`
}

/**
 * Mints a preview-store via Core's preview-stores orchestrator and persists the
 * returned admin token as a `kind: 'preview'` session in the same LocalStorage
 * bucket that `shopify store execute` reads from. After this call, the preview
 * store can be used as a target for `shopify store execute --store <fqdn> ...`
 * with no further setup.
 */
export async function createPreviewStoreCommand(
  input: CreatePreviewStoreInput,
  now: () => Date = () => new Date(),
): Promise<CreatePreviewStoreResult> {
  const clientOptions = defaultPreviewStoreClientOptions(input.client)

  const response = await createPreviewStore(
    {
      shopName: input.shopName,
      email: input.email,
      country: input.country,
    },
    clientOptions,
  )

  // We persist the store-auth bucket FIRST, then best-effort the Identity import.
  // Rationale: a failed Identity import (e.g. single-audience token, network blip)
  // must not leave the just-created shop orphaned on the CLI side — `store execute`
  // / `store list` against the new shop should keep working regardless. The
  // Identity session is purely additive: when it succeeds, downstream commands
  // resolve the placeholder as the active CLI user; when it fails, the legacy
  // synthetic `placeholder:<uuid>` userId path is what we already have.
  //
  // Note: this means the store-auth bucket is keyed under the synthetic id on
  // every run. If we ever want the bucket and Identity session to share a userId
  // we'd need to do the import first AND have it succeed reliably; not worth the
  // coupling today.
  const result = persistPreviewStoreSession(response, clientOptions, now)

  if (response.cliIdentityBootstrap) {
    // The Admin entry in the imported Identity session has to carry a *shop-app*
    // token (the `shpat_*` from `store_auth_bootstrap.access_token`), not the
    // Identity OAuth token from `cli_identity_bootstrap`. The Admin API rejects
    // Identity-issued tokens with `[API] Service is not valid for authentication`.
    // We pull it from the same `storeAuthBootstrap` block that drove the
    // store-auth bucket above (preferred) and fall back to the top-level
    // legacy `adminApiToken` for back-compat with the original PoC orchestrator.
    const adminShopToken = response.storeAuthBootstrap?.accessToken ?? response.adminApiToken
    const identityImport = await adoptCliIdentityBootstrap(
      response.cliIdentityBootstrap,
      response.placeholderAccountUuid,
      {[result.shopPermanentDomain]: adminShopToken},
    ).catch((error: unknown) => {
      // Best-effort: log and continue. The shop is already persisted on disk
      // above, so the user can still execute against it via the Admin token.
      const message = error instanceof Error ? error.message : String(error)
      outputWarn(`Identity session import failed; continuing without an Identity-backed session.\n  Reason: ${message}`)
      return undefined
    })
    if (identityImport) {
      result.identityImported = true
      result.identityUserId = identityImport.userId
    }
  }

  return result
}

async function adoptCliIdentityBootstrap(
  bootstrap: PreviewCliIdentityBootstrap,
  placeholderAccountUuid: string,
  adminStoreTokens: Record<string, string>,
): Promise<{userId: string}> {
  if (
    !Number.isFinite(bootstrap.expiresIn) ||
    bootstrap.expiresIn <= 0 ||
    bootstrap.expiresIn > MAX_BOOTSTRAP_IDENTITY_LIFETIME_SECONDS
  ) {
    throw new AbortError(
      'Preview store returned an invalid CLI identity bootstrap expiry.',
      `Expected a positive seconds value <= ${MAX_BOOTSTRAP_IDENTITY_LIFETIME_SECONDS}; got ${String(bootstrap.expiresIn)}.`,
    )
  }

  return importIdentitySession({
    accessToken: bootstrap.accessToken,
    refreshToken: bootstrap.refreshToken,
    expiresAt: new Date(Date.now() + bootstrap.expiresIn * 1000),
    // Prefer the explicit user id from the orchestrator; fall back to the
    // placeholder account UUID so the session bucket always matches the
    // ResourceOwner id on the Identity side.
    userId: bootstrap.userId ?? placeholderAccountUuid,
    // Pass the per-shop Admin (`shpat_*`) tokens so `importIdentitySession`
    // seeds the store-prefixed Admin entry that
    // `ensureAuthenticatedAdmin(storeFqdn)` looks up. The Identity OAuth token
    // alone is rejected by the Admin API; we have to cache the shop-app
    // token explicitly under the right key.
    adminStoreTokens,
  })
}

function persistPreviewStoreSession(
  response: PreviewStoreCreateResponse,
  clientOptions: PreviewStoreClientOptions,
  now: () => Date,
): CreatePreviewStoreResult {
  const acquiredAt = now()
  const acquiredAtIso = acquiredAt.toISOString()
  const magicLinkExpiresAt = new Date(acquiredAt.getTime() + MAGIC_LINK_TTL_MS).toISOString()
  // The store-auth bucket is always keyed under the synthetic `placeholder:<uuid>`
  // userId. The Identity bootstrap (when present) is persisted under a *separate*
  // bucket in `Sessions[identityFqdn][<uuid>]` by `importIdentitySession`, and the
  // two are intentionally decoupled so a failed import doesn't orphan the shop.
  const userId = placeholderUserId(response.placeholderAccountUuid)

  // Record fqdn metadata before and after so analytics see the same shape we emit
  // for PKCE-authed stores: an unvalidated record at request time, validated record
  // once we have a usable token.
  recordStoreFqdnMetadata(response.shopPermanentDomain, false).catch(() => undefined)

  const storeAuth = resolveStoreAuth(response.storeAuthBootstrap, response)
  // When the orchestrator returns a `store_auth_bootstrap`, its `shopDomain`
  // is the host that actually serves the Admin API for this shop in the
  // current environment (`*.dev-api.shop.dev` on the rig). The top-level
  // `shop_permanent_domain` is the canonical/display domain (`*.my.shop.dev`)
  // but doesn't route to a running Spin instance. Surface the routable host
  // as `shopPermanentDomain` so users can pass it straight to
  // `store execute --store ...` and the URL the CLI builds resolves.
  const routableShopDomain = storeAuth.store

  setStoredStoreAppSession({
    store: storeAuth.store,
    clientId: storeAuth.clientId,
    userId,
    accessToken: storeAuth.accessToken,
    scopes: storeAuth.scopes,
    acquiredAt: acquiredAtIso,
    kind: 'preview',
    preview: {
      placeholderAccountUuid: response.placeholderAccountUuid,
      coreUrl: clientOptions.coreUrl,
      magicLinkUrl: response.magicLinkUrl,
      magicLinkExpiresAt,
    },
  })

  recordStoreFqdnMetadata(response.shopPermanentDomain, true).catch(() => undefined)
  setLastSeenUserId(userId)

  return {
    shopId: response.shopId,
    shopPermanentDomain: routableShopDomain,
    placeholderAccountUuid: response.placeholderAccountUuid,
    adminApiToken: storeAuth.accessToken,
    magicLinkUrl: response.magicLinkUrl,
    magicLinkExpiresAt,
    userId,
    identityImported: false,
  }
}

/**
 * Reconciles the two possible sources of the persisted store-auth fields:
 *
 * - `store_auth_bootstrap` from the orchestrator (preferred when present;
 *   carries the real per-shop `apiKey` / granted `scopes` from Core), or
 * - The legacy top-level `admin_api_token` from the original PoC contract,
 *   keyed by the CLI-side `STORE_AUTH_APP_CLIENT_ID` and the empty-scopes
 *   sentinel.
 *
 * Note: the bucket is *always* keyed under `response.shopPermanentDomain`
 * (the `.my.shop.dev` form), regardless of whether the bootstrap reports a
 * separate `shopDomain` (`.dev-api.shop.dev`). The permanent domain is what
 * the user passes to downstream commands (`store execute --store ...`,
 * `store list`), so the lookup key has to match it. The bootstrap's
 * `shopDomain` is treated as informational only.
 */
function resolveStoreAuth(
  bootstrap: PreviewStoreAuthBootstrap | undefined,
  response: PreviewStoreCreateResponse,
): {store: string; clientId: string; accessToken: string; scopes: string[]} {
  if (bootstrap) {
    return {
      // Key the bucket under the bootstrap's `shopDomain` because that's the
      // host that actually serves the Admin API for this shop in the current
      // environment. The top-level `shop_permanent_domain` is canonical but
      // doesn't route to a live Spin instance on the rig, so we surface
      // `shopDomain` to the user as the value to pass to `--store`.
      store: bootstrap.shopDomain,
      clientId: bootstrap.apiKey,
      accessToken: bootstrap.accessToken,
      scopes: bootstrap.scopes,
    }
  }
  return {
    store: response.shopPermanentDomain,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    accessToken: response.adminApiToken,
    scopes: PREVIEW_STORE_SCOPES,
  }
}
