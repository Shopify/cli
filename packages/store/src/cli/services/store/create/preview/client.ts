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
 * Response from `POST /services/preview-stores`. Field names mirror the snake_case
 * JSON contract emitted by `Services::PreviewStoresController#create`.
 */
export interface PreviewStoreCreateResponse {
  shopId: number
  shopPermanentDomain: string
  placeholderAccountUuid: string
  adminApiToken: string
  magicLinkUrl: string
}

interface RawPreviewStoreCreateResponse {
  shop_id?: unknown
  shop_permanent_domain?: unknown
  placeholder_account_uuid?: unknown
  admin_api_token?: unknown
  magic_link_url?: unknown
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

  return {
    shopId,
    shopPermanentDomain,
    placeholderAccountUuid,
    adminApiToken,
    magicLinkUrl,
  }
}
