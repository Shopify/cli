import {
  CLI_INSTANCE_HEADER,
  CLI_VERSION_HEADER,
  createPreviewStore,
  getOrCreateCliInstanceId,
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

  test('POSTs to /services/preview-stores with optional name and country variables and no authorization', async () => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(
      response(201, {
        shop: {id: 123, name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
        placeholder_account_uuid: 'placeholder-uuid',
        admin_api_token: 'shpat_token',
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
      accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
    })
  })

  test('omits name and country variables when absent', async () => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(
      response(201, {
        shop: {id: 123, name: 'My Store', domain: 'x.myshopify.com'},
        admin_api_token: 'shpat_token',
        access_url: 'https://app.shopify.com/auth/preview-store?token=access-token',
      }),
    )

    await createPreviewStore({}, {storage: inMemoryStorage('instance-1')})

    expect(vi.mocked(shopifyFetch).mock.calls[0]![1]!.body).toBe('{}')
  })

  test.each([
    ['service_unavailable', 503, 'Preview store creation is not enabled yet.'],
    ['not_in_rollout', 503, 'Preview store creation is not enabled yet.'],
    ['dependency_unavailable', 503, 'Preview store creation is temporarily unavailable.'],
    ['preview_store_create_failed', 422, 'Preview store creation failed.'],
    ['preview_store_create_failed', 500, 'Preview store creation failed.'],
    ['shop_name_invalid', 422, 'The preview store name was rejected.'],
    ['shop_name_banned_keyword', 422, 'The preview store name was rejected.'],
    ['country_invalid', 422, 'The preview store country was rejected.'],
  ])('maps %s errors', async (errorCode, status, message) => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce(response(status, {error_code: errorCode, message: 'server message'}))

    await expect(createPreviewStore({}, {storage: inMemoryStorage('instance-1')})).rejects.toThrow(message)
  })

  test('rejects malformed success responses without leaking the admin API token or access URL', async () => {
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
})
