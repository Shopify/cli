import {
  DEFAULT_PREVIEW_CLI_SECRET,
  DEFAULT_PREVIEW_CLI_USERNAME,
  DEFAULT_PREVIEW_CORE_URL,
  createPreviewStore,
  defaultPreviewStoreClientOptions,
} from './client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/http')

function fakeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 201,
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

function fakeNotOkResponse(status: number, body: string): Response {
  return {
    ok: false,
    status,
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

const validBody = {
  shop_id: 21,
  shop_permanent_domain: 'preview-1.myshopify.io',
  placeholder_account_uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  admin_api_token: 'shpat_preview_token',
  magic_link_url: 'https://app.shop.dev/auth/preview-store?token=abc',
}

describe('defaultPreviewStoreClientOptions', () => {
  test('returns the development-rig defaults when no overrides are passed', () => {
    expect(defaultPreviewStoreClientOptions()).toEqual({
      coreUrl: DEFAULT_PREVIEW_CORE_URL,
      cliUsername: DEFAULT_PREVIEW_CLI_USERNAME,
      cliSecret: DEFAULT_PREVIEW_CLI_SECRET,
    })
  })

  test('layers overrides on top of the defaults', () => {
    expect(defaultPreviewStoreClientOptions({coreUrl: 'https://core.example/'})).toEqual({
      coreUrl: 'https://core.example/',
      cliUsername: DEFAULT_PREVIEW_CLI_USERNAME,
      cliSecret: DEFAULT_PREVIEW_CLI_SECRET,
    })
  })
})

describe('createPreviewStore', () => {
  beforeEach(() => {
    vi.mocked(shopifyFetch).mockReset()
  })

  test('POSTs to /services/preview-stores with snake_case body and basic auth', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(fakeOkResponse(validBody))

    await createPreviewStore({shopName: 'preview-demo', email: 'demo@previewstore.invalid', country: 'CA'})

    expect(shopifyFetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(shopifyFetch).mock.calls[0]!
    expect(url).toBe(`${DEFAULT_PREVIEW_CORE_URL}/services/preview-stores`)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      shop_name: 'preview-demo',
      email: 'demo@previewstore.invalid',
      country: 'CA',
    })
    const headers = init?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers.Accept).toBe('application/json')
    expect(headers.Authorization).toMatch(/^Basic /)
    const decoded = Buffer.from(headers.Authorization!.replace('Basic ', ''), 'base64').toString()
    expect(decoded).toBe(`${DEFAULT_PREVIEW_CLI_USERNAME}:${DEFAULT_PREVIEW_CLI_SECRET}`)
  })

  test('omits optional fields from the request body when they are not provided', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(fakeOkResponse(validBody))

    await createPreviewStore({shopName: 'preview-demo'})

    const init = vi.mocked(shopifyFetch).mock.calls[0]![1]!
    expect(JSON.parse(init.body as string)).toEqual({shop_name: 'preview-demo'})
  })

  test('translates the snake_case JSON contract into the camelCase response type', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(fakeOkResponse(validBody))

    const response = await createPreviewStore({shopName: 'preview-demo'})

    expect(response).toEqual({
      shopId: 21,
      shopPermanentDomain: 'preview-1.myshopify.io',
      placeholderAccountUuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      adminApiToken: 'shpat_preview_token',
      magicLinkUrl: 'https://app.shop.dev/auth/preview-store?token=abc',
    })
  })

  test('strips a trailing slash from the configured Core URL when building the request URL', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(fakeOkResponse(validBody))

    await createPreviewStore(
      {shopName: 'preview-demo'},
      {coreUrl: 'https://core.example/', cliUsername: 'u', cliSecret: 's'},
    )

    expect(vi.mocked(shopifyFetch).mock.calls[0]![0]).toBe('https://core.example/services/preview-stores')
  })

  test('surfaces non-2xx responses with status, URL, and a truncated body', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(
      fakeNotOkResponse(502, '{"error":"identity_api_error","detail":"Identity request failed"}'),
    )

    await expect(createPreviewStore({shopName: 'preview-demo'})).rejects.toMatchObject({
      message: expect.stringContaining('returned HTTP 502'),
    })
  })

  test('surfaces a non-empty body even when the response is OK but not JSON', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(fakeOkResponse('<html>oops</html>'))

    await expect(createPreviewStore({shopName: 'preview-demo'})).rejects.toBeInstanceOf(AbortError)
  })

  test('rejects responses missing required identifier fields', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(fakeOkResponse({...validBody, admin_api_token: undefined}))

    await expect(createPreviewStore({shopName: 'preview-demo'})).rejects.toMatchObject({
      message: expect.stringContaining('missing required fields'),
    })
  })

  test('rejects responses where required fields have the wrong type', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(fakeOkResponse({...validBody, shop_id: '21'}))

    await expect(createPreviewStore({shopName: 'preview-demo'})).rejects.toMatchObject({
      message: expect.stringContaining('missing required fields'),
    })
  })
})
