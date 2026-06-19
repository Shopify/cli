import {appManagementFqdn, normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {AbortError} from '@shopify/cli-kit/node/error'
import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

export const CLI_INSTANCE_HEADER = 'X-Shopify-CLI-Instance'
export const CLI_VERSION_HEADER = 'X-Shopify-CLI-Version'

interface PreviewStoreClientStorageSchema {
  cliInstanceId?: string
}

interface PreviewStoreRequestOptions {
  storage?: LocalStorage<PreviewStoreClientStorageSchema>
}

let _clientStorage: LocalStorage<PreviewStoreClientStorageSchema> | undefined

function clientStorage() {
  _clientStorage ??= new LocalStorage<PreviewStoreClientStorageSchema>({projectName: 'shopify-cli-store'})
  return _clientStorage
}

export interface PreviewStoreClientOptions extends PreviewStoreRequestOptions {}

interface PreviewStoreCreateRequest {
  name?: string
  country?: string
}

interface PreviewStoreResponseShop {
  id: string
  name: string
  domain: string
}

export interface PreviewStoreCreateResponse {
  shop: PreviewStoreResponseShop
  placeholderAccountUuid?: string
  adminApiToken: string
  accessUrl: string
}

interface RawPreviewStoreResponseShop {
  id?: unknown
  name?: unknown
  domain?: unknown
}

interface RawPreviewStoreCreateResponse {
  shop?: RawPreviewStoreResponseShop
  placeholder_account_uuid?: unknown
  admin_api_token?: unknown
  access_url?: unknown
}

interface PreviewStoreClaimRequest {
  shopId: string
  adminApiToken: string
  email?: string
}

interface PreviewStoreClaimResponse {
  claimUrl: string
}

interface RawPreviewStoreClaimResponse {
  claim_url?: unknown
}

interface RawPreviewStoreErrorResponse {
  error_code?: string
  message?: string
}

export function getOrCreateCliInstanceId(
  storage: LocalStorage<PreviewStoreClientStorageSchema> = clientStorage(),
): string {
  const existing = storage.get('cliInstanceId')
  if (typeof existing === 'string' && existing.length > 0) return existing

  const next = randomUUID()
  storage.set('cliInstanceId', next)
  return next
}

function previewStoreBaseHeaders(cliInstanceId: string): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': `Shopify CLI; v=${CLI_KIT_VERSION}`,
    [CLI_INSTANCE_HEADER]: cliInstanceId,
    [CLI_VERSION_HEADER]: CLI_KIT_VERSION,
  }
}

export function previewStoreCreateHeaders(cliInstanceId: string): Record<string, string> {
  return previewStoreBaseHeaders(cliInstanceId)
}

export function previewStoreClaimHeaders(cliInstanceId: string, adminApiToken: string): Record<string, string> {
  return {
    ...previewStoreBaseHeaders(cliInstanceId),
    authorization: adminApiToken,
    'X-Shopify-Access-Token': adminApiToken,
  }
}

export async function createPreviewStore(
  request: PreviewStoreCreateRequest,
  options: PreviewStoreClientOptions = {},
): Promise<PreviewStoreCreateResponse> {
  const fqdn = await appManagementFqdn()
  const url = `https://${fqdn}/services/preview-stores`
  const body = JSON.stringify({
    ...(request.name ? {name: request.name} : {}),
    ...(request.country
      ? {
          variables: {
            storeCreatePayload: {
              country: request.country,
            },
          },
        }
      : {}),
  })

  const response = await shopifyFetch(url, {
    method: 'POST',
    headers: previewStoreCreateHeaders(getOrCreateCliInstanceId(options.storage)),
    body,
  })

  const rawText = await response.text()
  if (!response.ok) {
    const error = previewStoreError(response.status, rawText)
    throw new AbortError(error.message, error.tryMessage)
  }

  let parsed: RawPreviewStoreCreateResponse
  try {
    parsed = JSON.parse(rawText) as RawPreviewStoreCreateResponse
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new AbortError(
      'Preview store creation returned a non-JSON response.',
      `Parse error: ${message}. Body (truncated): ${redactPreviewStoreRawText(rawText).slice(0, 500)}`,
    )
  }

  return narrowCreateResponse(parsed)
}

export async function claimPreviewStore(
  request: PreviewStoreClaimRequest,
  options: PreviewStoreRequestOptions = {},
): Promise<PreviewStoreClaimResponse> {
  const fqdn = await appManagementFqdn()
  const url = `https://${fqdn}/services/preview-stores/${encodeURIComponent(request.shopId)}/claim`
  const body = JSON.stringify({...(request.email ? {email: request.email} : {})})

  const response = await shopifyFetch(url, {
    method: 'POST',
    headers: previewStoreClaimHeaders(getOrCreateCliInstanceId(options.storage), request.adminApiToken),
    body,
  })

  const rawText = await response.text()
  if (!response.ok) {
    const error = previewStoreClaimError(response.status, rawText)
    throw new AbortError(error.message, error.tryMessage)
  }

  let parsed: RawPreviewStoreClaimResponse
  try {
    parsed = JSON.parse(rawText) as RawPreviewStoreClaimResponse
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new AbortError(
      'Preview store claim URL request returned a non-JSON response.',
      `Parse error: ${message}. Body (truncated): ${redactPreviewStoreRawText(rawText).slice(0, 500)}`,
    )
  }

  return narrowClaimResponse(parsed)
}

function previewStoreError(status: number, rawText: string): {message: string; tryMessage?: string} {
  const parsed = parseErrorBody(rawText)
  const errorCode = parsed.error_code
  const message = parsed.message

  if (errorCode === 'not_in_rollout') {
    return {
      message: 'Preview store creation is not enabled yet.',
      tryMessage: 'Try again later.',
    }
  }

  if (errorCode === 'service_unavailable') {
    return {message: 'Preview store creation is temporarily unavailable.', tryMessage: 'Try again later.'}
  }

  if (errorCode === 'rate_limited') {
    return {message: 'Too many preview store creation requests.', tryMessage: 'Try again later.'}
  }

  if (errorCode === 'preview_store_create_failed') {
    return {message: 'Preview store creation failed.', tryMessage: 'Try again later.'}
  }

  if (errorCode === 'shop_name_banned_keyword' || errorCode === 'shop_name_invalid') {
    return {message: 'The preview store name was rejected.', tryMessage: 'Use a different store name and try again.'}
  }

  if (errorCode === 'country_invalid') {
    return {message: 'The preview store country was rejected.', tryMessage: 'Use a different country and try again.'}
  }

  const redactedRawText = redactPreviewStoreRawText(rawText)

  return {
    message: `Preview store creation failed with HTTP ${status}.`,
    tryMessage: message ?? (redactedRawText.length > 0 ? redactedRawText.slice(0, 1000) : 'No response body returned.'),
  }
}

function parseErrorBody(rawText: string): RawPreviewStoreErrorResponse {
  if (rawText.length === 0) return {}

  try {
    const parsed: unknown = JSON.parse(rawText)
    if (!parsed || typeof parsed !== 'object') return {}

    const body = parsed as Record<string, unknown>
    return {
      ...(typeof body.error_code === 'string' ? {error_code: body.error_code} : {}),
      ...(typeof body.message === 'string' ? {message: body.message} : {}),
    }
  } catch (error) {
    if (error instanceof SyntaxError) return {}
    throw error
  }
}

function previewStoreClaimError(status: number, rawText: string): {message: string; tryMessage?: string} {
  const parsed = parseErrorBody(rawText)
  const redactedRawText = redactPreviewStoreRawText(rawText)

  return {
    message: `Preview store claim URL request failed with HTTP ${status}.`,
    tryMessage:
      parsed.message ?? (redactedRawText.length > 0 ? redactedRawText.slice(0, 1000) : 'No response body returned.'),
  }
}

function narrowCreateResponse(parsed: RawPreviewStoreCreateResponse): PreviewStoreCreateResponse {
  const shop = parsed.shop
  const id = typeof shop?.id === 'string' || typeof shop?.id === 'number' ? String(shop.id) : undefined
  const name = typeof shop?.name === 'string' ? shop.name : undefined
  const domain = typeof shop?.domain === 'string' ? normalizeStoreFqdn(shop.domain) : undefined
  const adminApiToken = typeof parsed.admin_api_token === 'string' ? parsed.admin_api_token : undefined
  const accessUrl = typeof parsed.access_url === 'string' ? parsed.access_url : undefined
  const placeholderAccountUuid =
    typeof parsed.placeholder_account_uuid === 'string' ? parsed.placeholder_account_uuid : undefined

  if (!id || !name || !domain || !adminApiToken || !accessUrl) {
    throw new AbortError(
      'Preview store creation response is missing required fields.',
      `Got: ${JSON.stringify(redactPreviewStoreResponse(parsed)).slice(0, 500)}`,
    )
  }

  return {
    shop: {id, name, domain},
    adminApiToken,
    accessUrl,
    ...(placeholderAccountUuid ? {placeholderAccountUuid} : {}),
  }
}

function narrowClaimResponse(parsed: RawPreviewStoreClaimResponse): PreviewStoreClaimResponse {
  const claimUrl = typeof parsed.claim_url === 'string' ? parsed.claim_url : undefined

  if (!claimUrl) {
    throw new AbortError(
      'Preview store claim URL response is missing required fields.',
      `Got: ${JSON.stringify(redactPreviewStoreClaimResponse(parsed)).slice(0, 500)}`,
    )
  }

  return {claimUrl}
}

function redactPreviewStoreResponse(parsed: RawPreviewStoreCreateResponse): RawPreviewStoreCreateResponse {
  return {
    ...parsed,
    ...(parsed.admin_api_token ? {admin_api_token: '[REDACTED]'} : {}),
    ...(parsed.access_url ? {access_url: '[REDACTED]'} : {}),
  }
}

function redactPreviewStoreClaimResponse(parsed: RawPreviewStoreClaimResponse): RawPreviewStoreClaimResponse {
  return {
    ...parsed,
    ...(parsed.claim_url ? {claim_url: '[REDACTED]'} : {}),
  }
}

function redactPreviewStoreRawText(rawText: string): string {
  return rawText
    .replace(/(["']?(?:admin_api_token|adminApiToken)["']?\s*:\s*["'])[^"']+/gi, '$1[REDACTED]')
    .replace(/(["']?(?:access_url|accessUrl|claim_url|claimUrl)["']?\s*:\s*["'])[^"']+/gi, '$1[REDACTED]')
    .replace(/([?&](?:token|access_token)=)[^&\s"'<>]+/gi, '$1[REDACTED]')
}
