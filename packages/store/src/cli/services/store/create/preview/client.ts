import {AbortError} from '@shopify/cli-kit/node/error'
import {shopifyFetch} from '@shopify/cli-kit/node/http'

/**
 * Default Core orchestrator URL for preview-store creation. Today this is the local
 * `app.shop.dev` rig used by the M1 prototype; the production endpoint will replace
 * this once Growth deploys the `services/preview-stores` controller.
 */
export const DEFAULT_PREVIEW_CORE_URL = 'https://app.shop.dev'

/**
 * Default basic-auth credentials for the prototype Core endpoint. These match the
 * dev-only secret hardcoded in `Services::PreviewStoresController` and MUST be
 * replaced with a proper service-auth pattern before this command ships to a
 * non-developer release channel.
 */
export const DEFAULT_PREVIEW_CLI_USERNAME = 'preview-store-cli'
export const DEFAULT_PREVIEW_CLI_SECRET = 'preview-store-cli-dev'

export interface PreviewStoreClientOptions {
  coreUrl: string
  cliUsername: string
  cliSecret: string
}

interface PreviewStoreCreateRequest {
  shopName: string
  email?: string
  country?: string
}

/**
 * Identity-side OAuth bootstrap returned by Core when the orchestrator was able
 * to mint a real `IdentityToken` + `refreshToken` for the placeholder account
 * (see `PlaceholderSessions::TokenBuilder` in shop/world).
 *
 * When present, the CLI imports this into the standard `Sessions[identityFqdn][userId]`
 * storage via `importIdentitySession`, so the placeholder behaves like a real
 * logged-in account for subsequent commands (organization list, partners API,
 * business-platform API, etc.). Optional for back-compat with the original PoC
 * orchestrator that only returned an Admin API token.
 */
export interface PreviewCliIdentityBootstrap {
  accessToken: string
  refreshToken: string
  expiresIn: number
  userId?: string
}

/**
 * Per-store auth bootstrap returned by Core describing the Admin API session
 * that should be persisted in the store-auth bucket. When present, the CLI uses
 * its `clientId` / `scopes` / `accessToken` / `shopDomain` fields verbatim in
 * place of the legacy `admin_api_token` + sentinel scopes path. Optional.
 */
export interface PreviewStoreAuthBootstrap {
  accessToken: string
  scopes: string[]
  apiKey: string
  shopDomain: string
}

/**
 * Response from `POST /services/preview-stores`. Field names mirror the snake_case
 * JSON contract emitted by `Services::PreviewStoresController#create`.
 */
export interface PreviewStoreCreateResponse {
  shopId: number
  shopPermanentDomain: string
  placeholderAccountUuid: string
  adminApiToken: string
  magicLinkUrl: string
  cliIdentityBootstrap?: PreviewCliIdentityBootstrap
  storeAuthBootstrap?: PreviewStoreAuthBootstrap
}

interface RawPreviewStoreCreateResponse {
  shop_id?: unknown
  shop_permanent_domain?: unknown
  placeholder_account_uuid?: unknown
  admin_api_token?: unknown
  magic_link_url?: unknown
  cli_identity_bootstrap?: unknown
  store_auth_bootstrap?: unknown
}

export function defaultPreviewStoreClientOptions(
  overrides: Partial<PreviewStoreClientOptions> = {},
): PreviewStoreClientOptions {
  return {
    coreUrl: overrides.coreUrl ?? DEFAULT_PREVIEW_CORE_URL,
    cliUsername: overrides.cliUsername ?? DEFAULT_PREVIEW_CLI_USERNAME,
    cliSecret: overrides.cliSecret ?? DEFAULT_PREVIEW_CLI_SECRET,
  }
}

function basicAuthHeader(username: string, secret: string): string {
  return `Basic ${Buffer.from(`${username}:${secret}`).toString('base64')}`
}

/**
 * POSTs the create-preview-store request to Core's orchestrator. Translates the
 * snake_case JSON contract into our camelCase response type and rejects responses
 * that don't carry the required identifiers.
 */
export async function createPreviewStore(
  request: PreviewStoreCreateRequest,
  options: PreviewStoreClientOptions = defaultPreviewStoreClientOptions(),
): Promise<PreviewStoreCreateResponse> {
  const url = `${options.coreUrl.replace(/\/$/, '')}/services/preview-stores`
  const body = JSON.stringify({
    shop_name: request.shopName,
    ...(request.email ? {email: request.email} : {}),
    ...(request.country ? {country: request.country} : {}),
  })

  const response = await shopifyFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: basicAuthHeader(options.cliUsername, options.cliSecret),
    },
    body,
  })

  const rawText = await response.text()
  if (!response.ok) {
    throw new AbortError(
      `Preview store creation failed: ${url} returned HTTP ${response.status}.`,
      rawText.length > 0 ? rawText.slice(0, 1000) : 'No response body returned.',
    )
  }

  let parsed: RawPreviewStoreCreateResponse
  try {
    parsed = JSON.parse(rawText) as RawPreviewStoreCreateResponse
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new AbortError(
      `Preview store creation returned a non-JSON response from ${url}.`,
      `Parse error: ${message}. Body (truncated): ${rawText.slice(0, 500)}`,
    )
  }

  return narrowResponse(parsed, url)
}

function narrowResponse(parsed: RawPreviewStoreCreateResponse, url: string): PreviewStoreCreateResponse {
  const shopId = typeof parsed.shop_id === 'number' ? parsed.shop_id : undefined
  const shopPermanentDomain =
    typeof parsed.shop_permanent_domain === 'string' ? parsed.shop_permanent_domain : undefined
  const placeholderAccountUuid =
    typeof parsed.placeholder_account_uuid === 'string' ? parsed.placeholder_account_uuid : undefined
  const adminApiToken = typeof parsed.admin_api_token === 'string' ? parsed.admin_api_token : undefined
  const magicLinkUrl = typeof parsed.magic_link_url === 'string' ? parsed.magic_link_url : undefined

  if (!shopId || !shopPermanentDomain || !placeholderAccountUuid || !adminApiToken || !magicLinkUrl) {
    throw new AbortError(
      `Preview store creation response from ${url} is missing required fields.`,
      `Got: ${JSON.stringify(parsed).slice(0, 500)}`,
    )
  }

  const cliIdentityBootstrap = narrowCliIdentityBootstrap(parsed.cli_identity_bootstrap)
  const storeAuthBootstrap = narrowStoreAuthBootstrap(parsed.store_auth_bootstrap)

  return {
    shopId,
    shopPermanentDomain,
    placeholderAccountUuid,
    adminApiToken,
    magicLinkUrl,
    ...(cliIdentityBootstrap ? {cliIdentityBootstrap} : {}),
    ...(storeAuthBootstrap ? {storeAuthBootstrap} : {}),
  }
}

function narrowCliIdentityBootstrap(value: unknown): PreviewCliIdentityBootstrap | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const accessToken = typeof raw.access_token === 'string' ? raw.access_token : undefined
  const refreshToken = typeof raw.refresh_token === 'string' ? raw.refresh_token : undefined
  const expiresIn = typeof raw.expires_in === 'number' && Number.isFinite(raw.expires_in) ? raw.expires_in : undefined
  const userId = typeof raw.user_id === 'string' ? raw.user_id : undefined

  // All three required fields must be present and well-typed; partial payloads
  // are dropped silently so a malformed bootstrap can't strand the create flow.
  if (!accessToken || !refreshToken || expiresIn === undefined) return undefined

  return {accessToken, refreshToken, expiresIn, ...(userId ? {userId} : {})}
}

function narrowStoreAuthBootstrap(value: unknown): PreviewStoreAuthBootstrap | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const accessToken = typeof raw.access_token === 'string' ? raw.access_token : undefined
  const apiKey = typeof raw.api_key === 'string' ? raw.api_key : undefined
  const shopDomain = typeof raw.shop_domain === 'string' ? raw.shop_domain : undefined
  const scopes = Array.isArray(raw.scopes) && raw.scopes.every((scope) => typeof scope === 'string')
    ? (raw.scopes as string[])
    : undefined

  if (!accessToken || !apiKey || !shopDomain || !scopes) return undefined

  return {accessToken, scopes, apiKey, shopDomain}
}
