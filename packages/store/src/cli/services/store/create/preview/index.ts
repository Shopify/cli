import {PreviewStoreClientOptions, PreviewStoreCreateResponse, createPreviewStore} from './client.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../../auth/config.js'
import {setStoredStoreAppSession} from '../../auth/session-store.js'
import {recordStoreFqdnMetadata} from '../../attribution.js'
import {setLastSeenUserId} from '@shopify/cli-kit/node/session'

export const PREVIEW_USER_ID_PREFIX = 'preview:'

interface CreatePreviewStoreInput {
  name?: string
  country?: string
  client?: PreviewStoreClientOptions
}

interface CreatePreviewStoreDependencies {
  createPreviewStore: typeof createPreviewStore
  setStoredStoreAppSession: typeof setStoredStoreAppSession
  recordStoreFqdnMetadata: typeof recordStoreFqdnMetadata
  setLastSeenUserId: typeof setLastSeenUserId
  now: () => Date
}

export interface CreatePreviewStoreResult {
  status: 'success'
  message: string
  store: {
    id: string
    name: string
    subdomain: string
    country?: string
    storefrontUrl: string
  }
}

const defaultDependencies: CreatePreviewStoreDependencies = {
  createPreviewStore,
  setStoredStoreAppSession,
  recordStoreFqdnMetadata,
  setLastSeenUserId,
  now: () => new Date(),
}

export async function createPreviewStoreCommand(
  input: CreatePreviewStoreInput,
  dependencies: Partial<CreatePreviewStoreDependencies> = {},
): Promise<CreatePreviewStoreResult> {
  const resolvedDependencies = {...defaultDependencies, ...dependencies}
  const response = await resolvedDependencies.createPreviewStore(
    {
      name: input.name,
      country: input.country,
    },
    input.client,
  )

  return persistPreviewStoreSession(response, input.country, resolvedDependencies)
}

function previewUserId(response: PreviewStoreCreateResponse): string {
  return `${PREVIEW_USER_ID_PREFIX}${response.placeholderAccountUuid ?? response.shop.id}`
}

async function persistPreviewStoreSession(
  response: PreviewStoreCreateResponse,
  country: string | undefined,
  dependencies: CreatePreviewStoreDependencies,
): Promise<CreatePreviewStoreResult> {
  const acquiredAt = dependencies.now().toISOString()
  const userId = previewUserId(response)

  dependencies.setStoredStoreAppSession({
    store: response.shop.domain,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId,
    accessToken: response.adminApiToken,
    scopes: response.adminApiScopes,
    acquiredAt,
    kind: 'preview',
    preview: {
      shopId: response.shop.id,
      name: response.shop.name,
      createdAt: acquiredAt,
      ...(response.placeholderAccountUuid ? {placeholderAccountUuid: response.placeholderAccountUuid} : {}),
      ...(country ? {country} : {}),
      accessUrl: response.accessUrl,
    },
  })
  dependencies.setLastSeenUserId(userId)
  try {
    await dependencies.recordStoreFqdnMetadata(response.shop.domain, true, response.shop.id)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // Store metadata is best-effort; credentials and access URL are already persisted.
  }

  return {
    status: 'success',
    message: `Your Shopify store "${response.shop.name}" is ready. This store is temporary. Create a free Shopify account to save it and start selling.`,
    store: {
      id: response.shop.id,
      name: response.shop.name,
      subdomain: response.shop.domain,
      ...(country ? {country} : {}),
      storefrontUrl: response.accessUrl,
    },
  }
}
