import {createThemePreview, updateThemePreview} from './preview.js'
import {DevServerSession} from '../theme-environment/types.js'
import {describe, expect, test, vi} from 'vitest'
import {shopifyFetch, Response} from '@shopify/cli-kit/node/http'

vi.mock('@shopify/cli-kit/node/http')

const session: DevServerSession = {
  token: 'admin_token_abc123',
  storeFqdn: 'store.myshopify.com',
  storefrontToken: 'token_111222333',
  storefrontPassword: 'password',
  sessionCookies: {},
}

const themeAccessSession: DevServerSession = {
  token: 'shptka_abc123',
  storeFqdn: 'store.myshopify.com',
  storefrontToken: 'shptka_abc123',
  storefrontPassword: 'password',
  sessionCookies: {},
}

function jsonResponse(body: object, options: {status?: number; statusText?: string} = {}): Response {
  const {status = 200, statusText = 'OK'} = options
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

describe('createThemePreview', () => {
  test('POSTs to the preview endpoint and returns url and preview_identifier', async () => {
    // Given
    const expectedThemeId = '123'
    const overrides = JSON.stringify({templates: {'index.liquid': '<h1>Hello</h1>'}})
    const responseBody = {url: 'https://abc.shopifypreview.com', preview_identifier: 'abc'}
    vi.mocked(shopifyFetch).mockResolvedValue(jsonResponse(responseBody))

    // When
    const result = await createThemePreview({
      session,
      overridesContent: overrides,
      themeId: expectedThemeId,
    })

    // Then
    expect(result).toEqual(responseBody)
    expect(shopifyFetch).toHaveBeenCalledWith(
      `https://${session.storeFqdn}/theme_preview.json?preview_theme_id=${expectedThemeId}`,
      expect.objectContaining({
        method: 'POST',
        body: overrides,
        headers: expect.objectContaining({
          Authorization: `Bearer ${session.storefrontToken}`,
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  test('throws AbortError when the response is not ok', async () => {
    // Given
    const expectedThemeId = '123'
    const overrides = JSON.stringify({templates: {}})
    vi.mocked(shopifyFetch).mockResolvedValue(jsonResponse({}, {status: 422, statusText: 'Unprocessable Entity'}))

    // When/Then
    await expect(createThemePreview({session, overridesContent: overrides, themeId: expectedThemeId})).rejects.toThrow(
      'Theme preview request failed with status 422: Unprocessable Entity',
    )
  })

  test('throws AbortError when the response body contains an error', async () => {
    // Given
    const expectedThemeId = '123'
    const overrides = JSON.stringify({templates: {}})
    vi.mocked(shopifyFetch).mockResolvedValue(
      jsonResponse({url: null, preview_identifier: null, error: 'Invalid template'}),
    )

    // When/Then
    await expect(createThemePreview({session, overridesContent: overrides, themeId: expectedThemeId})).rejects.toThrow(
      'Theme preview failed: Invalid template',
    )
  })
})

describe('updateThemePreview', () => {
  test('POSTs to the preview endpoint with a session identifier and returns url and preview_identifier', async () => {
    // Given
    const expectedThemeId = '123'
    const overrides = JSON.stringify({templates: {'index.liquid': '<h1>Hello</h1>'}})
    const responseBody = {url: 'https://abc.shopifypreview.com', preview_identifier: 'abc'}
    const expectedSessionIdentifier = '1234-abc'
    vi.mocked(shopifyFetch).mockResolvedValue(jsonResponse(responseBody))

    // When
    const result = await updateThemePreview({
      session,
      overridesContent: overrides,
      themeId: expectedThemeId,
      previewIdentifier: expectedSessionIdentifier,
    })

    // Then
    expect(result).toEqual(responseBody)
    expect(shopifyFetch).toHaveBeenCalledWith(
      `https://${session.storeFqdn}/theme_preview.json?preview_theme_id=${expectedThemeId}&preview_identifier=${expectedSessionIdentifier}`,
      expect.objectContaining({
        method: 'POST',
        body: overrides,
        headers: expect.objectContaining({
          Authorization: `Bearer ${session.storefrontToken}`,
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  test('encodes the session identifier in the URL', async () => {
    // Given
    const expectedThemeId = '123'
    const overrides = JSON.stringify({templates: {}})
    const responseBody = {url: 'https://abc.shopifypreview.com', preview_identifier: 'abc'}
    vi.mocked(shopifyFetch).mockResolvedValue(jsonResponse(responseBody))

    // When
    await updateThemePreview({
      session,
      overridesContent: overrides,
      themeId: expectedThemeId,
      previewIdentifier: 'token with spaces&special=chars',
    })

    // Then
    expect(shopifyFetch).toHaveBeenCalledWith(
      `https://${session.storeFqdn}/theme_preview.json?preview_theme_id=${expectedThemeId}&preview_identifier=token%20with%20spaces%26special%3Dchars`,
      expect.any(Object),
    )
  })

  test('throws AbortError when the response is not ok', async () => {
    // Given
    const expectedThemeId = '123'
    const overrides = JSON.stringify({templates: {}})
    vi.mocked(shopifyFetch).mockResolvedValue(jsonResponse({}, {status: 422, statusText: 'Unprocessable Entity'}))

    // When/Then
    await expect(
      updateThemePreview({
        session,
        overridesContent: overrides,
        themeId: expectedThemeId,
        previewIdentifier: '1234-abc',
      }),
    ).rejects.toThrow('Theme preview request failed with status 422: Unprocessable Entity')
  })

  test('throws AbortError when the response body contains an error', async () => {
    // Given
    const expectedThemeId = '123'
    const overrides = JSON.stringify({templates: {}})
    vi.mocked(shopifyFetch).mockResolvedValue(
      jsonResponse({url: null, preview_identifier: null, error: 'Session expired'}),
    )

    // When/Then
    await expect(
      updateThemePreview({
        session,
        overridesContent: overrides,
        themeId: expectedThemeId,
        previewIdentifier: '1234-abc',
      }),
    ).rejects.toThrow('Theme preview failed: Session expired')
  })
})

describe('Theme Access headers', () => {
  test('createThemePreview includes Theme Access headers when using a shptka_ token', async () => {
    // Given
    const overrides = JSON.stringify({templates: {}})
    const responseBody = {url: 'https://abc.shopifypreview.com', preview_identifier: 'abc'}
    vi.mocked(shopifyFetch).mockResolvedValue(jsonResponse(responseBody))

    // When
    await createThemePreview({
      session: themeAccessSession,
      overridesContent: overrides,
      themeId: '123',
    })

    // Then
    expect(shopifyFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Shopify-Shop': 'store.myshopify.com',
          'X-Shopify-Access-Token': 'shptka_abc123',
          Authorization: 'Bearer shptka_abc123',
        }),
      }),
    )
  })

  test('updateThemePreview includes Theme Access headers when using a shptka_ token', async () => {
    // Given
    const overrides = JSON.stringify({templates: {}})
    const responseBody = {url: 'https://abc.shopifypreview.com', preview_identifier: 'abc'}
    vi.mocked(shopifyFetch).mockResolvedValue(jsonResponse(responseBody))

    // When
    await updateThemePreview({
      session: themeAccessSession,
      overridesContent: overrides,
      themeId: '123',
      previewIdentifier: 'abc',
    })

    // Then
    expect(shopifyFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Shopify-Shop': 'store.myshopify.com',
          'X-Shopify-Access-Token': 'shptka_abc123',
          Authorization: 'Bearer shptka_abc123',
        }),
      }),
    )
  })

  test('createThemePreview does not include Theme Access headers for standard tokens', async () => {
    // Given
    const overrides = JSON.stringify({templates: {}})
    const responseBody = {url: 'https://abc.shopifypreview.com', preview_identifier: 'abc'}
    vi.mocked(shopifyFetch).mockResolvedValue(jsonResponse(responseBody))

    // When
    await createThemePreview({
      session,
      overridesContent: overrides,
      themeId: '123',
    })

    // Then
    const callHeaders = vi.mocked(shopifyFetch).mock.calls[0]![1]!.headers as Record<string, string>
    expect(callHeaders).not.toHaveProperty('X-Shopify-Shop')
    expect(callHeaders).not.toHaveProperty('X-Shopify-Access-Token')
  })
})
