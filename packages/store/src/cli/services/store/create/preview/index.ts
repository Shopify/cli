import {
  PreviewStoreClientOptions,
  PreviewStoreCreateResponse,
  createPreviewStore,
  defaultPreviewStoreClientOptions,
} from './client.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../../auth/config.js'
import {setStoredStoreAppSession} from '../../auth/session-store.js'
import {recordStoreFqdnMetadata} from '../../attribution.js'
import {setLastSeenUserId} from '@shopify/cli-kit/node/session'

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
  /** The synthetic user id under which the session was persisted in the local store. */
  userId: string
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

  return persistPreviewStoreSession(response, clientOptions, now)
}

function persistPreviewStoreSession(
  response: PreviewStoreCreateResponse,
  clientOptions: PreviewStoreClientOptions,
  now: () => Date,
): CreatePreviewStoreResult {
  const acquiredAt = now()
  const acquiredAtIso = acquiredAt.toISOString()
  const magicLinkExpiresAt = new Date(acquiredAt.getTime() + MAGIC_LINK_TTL_MS).toISOString()
  const userId = placeholderUserId(response.placeholderAccountUuid)

  // Record fqdn metadata before and after so analytics see the same shape we emit
  // for PKCE-authed stores: an unvalidated record at request time, validated record
  // once we have a usable token.
  recordStoreFqdnMetadata(response.shopPermanentDomain, false).catch(() => undefined)

  setStoredStoreAppSession({
    store: response.shopPermanentDomain,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId,
    accessToken: response.adminApiToken,
    scopes: PREVIEW_STORE_SCOPES,
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
    shopPermanentDomain: response.shopPermanentDomain,
    placeholderAccountUuid: response.placeholderAccountUuid,
    adminApiToken: response.adminApiToken,
    magicLinkUrl: response.magicLinkUrl,
    magicLinkExpiresAt,
    userId,
  }
}
