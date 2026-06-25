import {
  CLI_INSTANCE_HEADER,
  CLI_VERSION_HEADER,
  createPreviewStore,
  getPreviewStore,
  getOrCreateCliInstanceId,
  previewStoreAuthenticatedHeaders,
  previewStoreCreateHeaders,
} from './client.js'
import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/context/fqdn', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/context/fqdn')>(
    '@shopify/cli-kit/node/context/fqdn',
  )
  return {...actual, appManagementFqdn: vi.fn(async () => 'app.shopify.com')}
})
vi.mock('@shopify/cli-kit/node/crypto', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/crypto')>('@shopify/cli-kit/node/crypto')
  return {...actual, randomUUID: vi.fn(() => 'cli-install-id')}
})

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Awaited<ReturnType<typeof shopifyFetch>>
}

function inMemoryStorage(initial?: string) {
  const values = new Map<string, unknown>()
  if (initial) values.set('cliInstanceId', initial)
  return {
    get: vi.fn((key: string) => values.get(key) as any),
    set: vi.fn((key: string, value: unknown) => values.set(key, value)),
    delete: vi.fn((key: string) => values.delete(key)),
  } as unknown as LocalStorage<{cliInstanceId?: string}>
}

describe('preview store client', () => {
  test('persists and reuses a stable CLI instance id', () => {
    const storage = inMemoryStorage()

    expect(getOrCreateCliInstanceId(storage)).toBe('cli-install-id')
    expect(getOrCreateCliInstanceId(storage)).toBe('cli-install-id')
    expect(storage.set).toHaveBeenCalledTimes(1)
  })

  test('builds production request headers', () => {
    expect(previewStoreCreateHeaders('instance-1')).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': `Shopify CLI; v=${CLI_KIT_VERSION}`,
      [CLI_INSTANCE_HEADER]: 'instance-1',
      [CLI_VERSION_HEADER]: CLI_KIT_VERSION,
    })
  })

  test('builds authenticated request headers with the Admin API token', () => {
    expect(previewStoreAuthenticatedHeaders('instance-1', 'shpat_token')).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': `Shopify CLI; v=${CLI_KIT_VERSION}`,
      [CLI_INSTANCE_HEADER]: 'instance-1',
      [CLI_VERSION_HEADER]: CLI_KIT_VERSION,
      authorization: 'shpat_token',
      'X-Shopify-Access-Token': 'shpat_token',
    })
  })

  test('POSTs to /services/preview-stores with optional name and country variables and no authorization', async () => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(
      response(201, {
        shop: {id: 123, name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
        placeholder_account_uuid: 'placeholder-uuid',
        admin_api_token: 'shpat_token',
        admin_api_scopes: ['read_themes', 'write_themes'],
        access_url: 'https://app.shopify.com/auth/preview-store?token=access-token',
      }),
    )

    const got = await createPreviewStore(
      {name: 'Lavender Candles', country: 'US'},
      {storage: inMemoryStorage('instance-1')},
    )

    expect(shopifyFetch).toHaveBeenCalledWith('https://app.shopify.com/services/preview-stores', {
      method: 'POST',
      headers: expect.objectContaining({
        [CLI_INSTANCE_HEADER]: 'instance-1',
        [CLI_VERSION_HEADER]: CLI_KIT_VERSION,
        'User-Agent': `Shopify CLI; v=${CLI_KIT_VERSION}`,
      }),
      body: JSON.stringify({
        name: 'Lavender Candles',
        variables: {storeCreatePayload: {country: 'US'}},
      }),
    })
    expect((vi.mocked(shopifyFetch).mock.calls[0]![1]!.headers as Record<string, string>).Authorization).toBeUndefined()
    expect(got).toEqual({
      shop: {id: '123', name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
      placeholderAccountUuid: 'placeholder-uuid',
      adminApiToken: 'shpat_token',
      adminApiScopes: ['read_themes', 'write_themes'],
      accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
    })
  })

  test('rejects the response when the backend omits admin API scopes', async () => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(
      response(201, {
        shop: {id: 123, name: 'My Store', domain: 'x.myshopify.com'},
        admin_api_token: 'shpat_token',
        access_url: 'https://app.shopify.com/auth/preview-store?token=access-token',
      }),
    )

    await expect(createPreviewStore({}, {storage: inMemoryStorage('instance-1')})).rejects.toThrow(
      'Preview store creation response is missing required fields.',
    )
  })

  test('drops non-string admin API scopes', async () => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(
      response(201, {
        shop: {id: 123, name: 'My Store', domain: 'x.myshopify.com'},
        admin_api_token: 'shpat_token',
        admin_api_scopes: ['read_themes', 42, null, 'write_themes'],
        access_url: 'https://app.shopify.com/auth/preview-store?token=access-token',
      }),
    )

    const got = await createPreviewStore({}, {storage: inMemoryStorage('instance-1')})

    expect(got.adminApiScopes).toEqual(['read_themes', 'write_themes'])
  })

  test('omits name and country variables when absent', async () => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(
      response(201, {
        shop: {id: 123, name: 'My Store', domain: 'x.myshopify.com'},
        admin_api_token: 'shpat_token',
        admin_api_scopes: ['read_themes', 'write_themes'],
        access_url: 'https://app.shopify.com/auth/preview-store?token=access-token',
      }),
    )

    await createPreviewStore({}, {storage: inMemoryStorage('instance-1')})

    expect(vi.mocked(shopifyFetch).mock.calls[0]![1]!.body).toBe('{}')
  })

  test.each([
    ['service_unavailable', 503, 'Preview store creation is temporarily unavailable.'],
    ['not_in_rollout', 503, 'Preview store creation is not enabled yet.'],
    ['rate_limited', 429, 'Too many preview store creation requests.'],
    ['preview_store_create_failed', 422, 'Preview store creation failed.'],
    ['preview_store_create_failed', 500, 'Preview store creation failed.'],
    ['shop_name_invalid', 422, 'The preview store name was rejected.'],
    ['shop_name_banned_keyword', 422, 'The preview store name was rejected.'],
    ['country_invalid', 422, 'The preview store country was rejected.'],
  ])('maps %s errors', async (errorCode, status, message) => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(response(status, {error_code: errorCode, message: 'server message'}))

    await expect(createPreviewStore({}, {storage: inMemoryStorage('instance-1')})).rejects.toThrow(message)
  })

  test('GETs /services/preview-stores/:shop_id with the Admin API token', async () => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(
      response(200, {
        shop: {id: 123, name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
        access_url: 'https://app.shopify.com/auth/preview-store?token=fresh-access-token',
        claim_url: 'https://admin.shopify.com/store-transfer/accept/claim-token',
      }),
    )

    const got = await getPreviewStore(
      {shopId: '123', adminApiToken: 'shpat_token'},
      {storage: inMemoryStorage('instance-1')},
    )

    expect(shopifyFetch).toHaveBeenCalledWith('https://app.shopify.com/services/preview-stores/123', {
      method: 'GET',
      headers: expect.objectContaining({
        [CLI_INSTANCE_HEADER]: 'instance-1',
        authorization: 'shpat_token',
        'X-Shopify-Access-Token': 'shpat_token',
      }),
    })
    expect(got).toEqual({
      shop: {id: '123', name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
      accessUrl: 'https://app.shopify.com/auth/preview-store?token=fresh-access-token',
      claimUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
    })
  })

  test('omits the claim URL when the backend degrades it to null', async () => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(
      response(200, {
        shop: {id: 123, name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
        access_url: 'https://app.shopify.com/auth/preview-store?token=fresh-access-token',
        claim_url: null,
      }),
    )

    const got = await getPreviewStore(
      {shopId: '123', adminApiToken: 'shpat_token'},
      {storage: inMemoryStorage('instance-1')},
    )

    expect(got).toEqual({
      shop: {id: '123', name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
      accessUrl: 'https://app.shopify.com/auth/preview-store?token=fresh-access-token',
    })
  })

  test('rejects malformed create responses without leaking the admin API token or access URL', async () => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(
      response(201, {
        shop: {id: 123},
        admin_api_token: 'shpat_token',
        access_url: 'https://app.shopify.com/auth/preview-store?token=access-token',
      }),
    )

    await expect(createPreviewStore({}, {storage: inMemoryStorage('instance-1')})).rejects.toMatchObject({
      message: 'Preview store creation response is missing required fields.',
      tryMessage: expect.stringMatching(/"admin_api_token":"\[REDACTED\]".*"access_url":"\[REDACTED\]"/),
    })
  })

  test('rejects non-JSON success responses without leaking the admin API token or access URL', async () => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(
      response(
        201,
        '{"shop":{"id":123},"admin_api_token":"shpat_token","access_url":"https://app.shopify.com/auth/preview-store?token=access-token"',
      ),
    )

    const error = (await createPreviewStore({}, {storage: inMemoryStorage('instance-1')}).catch(
      (caught: unknown) => caught,
    )) as {tryMessage: string}

    expect(error).toMatchObject({
      message: 'Preview store creation returned a non-JSON response.',
      tryMessage: expect.stringContaining('"admin_api_token":"[REDACTED]"'),
    })
    expect(error.tryMessage).not.toContain('shpat_token')
    expect(error.tryMessage).not.toContain('access-token')
  })

  test('redacts raw response fallback diagnostics', async () => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(
      response(
        500,
        'Preview store failed after creating https://app.shopify.com/auth/preview-store?token=access-token with admin_api_token: "shpat_token"',
      ),
    )

    const error = (await createPreviewStore({}, {storage: inMemoryStorage('instance-1')}).catch(
      (caught: unknown) => caught,
    )) as {tryMessage: string}

    expect(error).toMatchObject({
      message: 'Preview store creation failed with HTTP 500.',
    })
    expect(error.tryMessage).not.toContain('access-token')
    expect(error.tryMessage).not.toContain('shpat_token')
  })

  test('rejects malformed preview store lookup responses without leaking the access URL', async () => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(
      response(200, {
        shop: {id: 123},
        access_url: 'https://app.shopify.com/auth/preview-store?token=fresh-access-token',
      }),
    )

    await expect(
      getPreviewStore({shopId: '123', adminApiToken: 'shpat_token'}, {storage: inMemoryStorage('instance-1')}),
    ).rejects.toMatchObject({
      message: 'Preview store lookup response is missing required fields.',
      tryMessage: expect.stringMatching(/"access_url":"\[REDACTED\]"/),
    })
  })
})
