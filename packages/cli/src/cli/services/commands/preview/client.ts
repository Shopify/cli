import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'

export interface PreviewCliIdentityBootstrap {
  access_token: string
  refresh_token: string
  expires_in: number
  user_id?: string
}

export interface PreviewStoreAuthBootstrap {
  access_token: string
  scopes: string[]
  api_key: string
  shop_domain: string
}

export interface PreviewStoreCreateResponse {
  shop_id: number
  shop_permanent_domain: string
  placeholder_account_uuid: string
  admin_api_token: string
  magic_link_url: string
  cli_identity_bootstrap?: PreviewCliIdentityBootstrap
  store_auth_bootstrap?: PreviewStoreAuthBootstrap
}

export interface PreviewStoreClaimResponse {
  claim_store_url: string
}

export interface PreviewStoreClientOptions {
  coreUrl: string
  cliUsername: string
  cliSecret: string
}

const DEFAULT_CORE_URL = 'https://app.shop.dev'
const DEFAULT_CLI_USERNAME = 'preview-store-cli'
const DEFAULT_CLI_SECRET = 'preview-store-cli-dev'

export function defaultClientOptions(overrides: Partial<PreviewStoreClientOptions> = {}): PreviewStoreClientOptions {
  return {
    coreUrl: overrides.coreUrl ?? DEFAULT_CORE_URL,
    cliUsername: overrides.cliUsername ?? DEFAULT_CLI_USERNAME,
    cliSecret: overrides.cliSecret ?? DEFAULT_CLI_SECRET,
  }
}

function basicAuthHeader(username: string, secret: string): string {
  return `Basic ${Buffer.from(`${username}:${secret}`).toString('base64')}`
}

async function postJson<T>(path: string, body: unknown, options: PreviewStoreClientOptions): Promise<T> {
  const url = `${options.coreUrl.replace(/\/$/, '')}${path}`
  const response = await shopifyFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuthHeader(options.cliUsername, options.cliSecret),
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new AbortError(
      `Preview store request to ${url} failed (HTTP ${response.status}).`,
      text || 'No response body returned.',
    )
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new AbortError(
      `Preview store request to ${url} returned non-JSON response.`,
      text.slice(0, 500),
    )
  }
}

export async function createPreviewStore(
  payload: {shop_name: string; email?: string; country?: string},
  options: PreviewStoreClientOptions,
): Promise<PreviewStoreCreateResponse> {
  return postJson<PreviewStoreCreateResponse>('/services/preview-stores', payload, options)
}

export async function claimPreviewStore(
  payload: {shop_id: number; email: string},
  options: PreviewStoreClientOptions,
): Promise<PreviewStoreClaimResponse> {
  return postJson<PreviewStoreClaimResponse>('/services/preview-stores/claim', payload, options)
}

export async function executePreviewStoreAdminQuery<T = unknown>(input: {
  domain: string
  token: string
  apiVersion: string
  query: string
  variables?: {[key: string]: unknown}
}): Promise<T> {
  try {
    return (await graphqlRequest<T>({
      query: input.query,
      api: 'Admin',
      url: adminUrl(input.domain, input.apiVersion),
      token: input.token,
      variables: input.variables,
      responseOptions: {handleErrors: false},
    })) as T
  } catch (error) {
    if (isGraphQLClientErrorLike(error) && error.response.errors) {
      throw new AbortError(
        'GraphQL operation failed.',
        JSON.stringify({errors: error.response.errors}, null, 2),
      )
    }
    throw error
  }
}

interface GraphQLClientErrorLike {
  response: {status?: number; errors?: unknown}
}

function isGraphQLClientErrorLike(error: unknown): error is GraphQLClientErrorLike {
  if (!error || typeof error !== 'object' || !('response' in error)) return false
  const response = (error as {response?: unknown}).response
  return Boolean(response) && typeof response === 'object'
}
