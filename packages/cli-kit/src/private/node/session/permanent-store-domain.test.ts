import {clearPermanentStoreFqdnCache, resolvePermanentStoreFqdn} from './permanent-store-domain.js'
import {fetch} from '../../../public/node/http.js'
import {mockAndCaptureOutput} from '../../../public/node/testing/output.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {Response} from 'node-fetch'

vi.mock('../../../public/node/http.js')

function metaJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}})
}

describe('resolvePermanentStoreFqdn', () => {
  beforeEach(() => {
    clearPermanentStoreFqdnCache()
    mockAndCaptureOutput().clear()
    vi.unstubAllEnvs()
  })

  test("returns the store's permanent domain from its public meta.json", async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(fetch).mockResolvedValueOnce(metaJson({myshopify_domain: 'abc123-xy.myshopify.com'}))

    // When
    const got = await resolvePermanentStoreFqdn('renamed-store.myshopify.com')

    // Then
    expect(got).toEqual('abc123-xy.myshopify.com')
    expect(fetch).toHaveBeenCalledWith(
      'https://renamed-store.myshopify.com/meta.json',
      {headers: {Accept: 'application/json'}},
      {useNetworkLevelRetry: false, useAbortSignal: true, timeoutMs: 5000},
    )
    expect(outputMock.info()).toContain(
      'Using the permanent domain abc123-xy.myshopify.com for renamed-store.myshopify.com.',
    )
  })

  test('returns the domain unchanged, without a message, when it already is the permanent domain', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(fetch).mockResolvedValueOnce(metaJson({myshopify_domain: 'my-store.myshopify.com'}))

    // When
    const got = await resolvePermanentStoreFqdn('my-store.myshopify.com')

    // Then
    expect(got).toEqual('my-store.myshopify.com')
    expect(outputMock.info()).toEqual('')
  })

  test('normalises the case of the permanent domain', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValueOnce(metaJson({myshopify_domain: 'My-Store.myshopify.com'}))

    // When
    const got = await resolvePermanentStoreFqdn('alias.myshopify.com')

    // Then
    expect(got).toEqual('my-store.myshopify.com')
  })

  test('caches the result for the store and its permanent domain', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValueOnce(metaJson({myshopify_domain: 'abc123-xy.myshopify.com'}))

    // When
    const first = await resolvePermanentStoreFqdn('renamed-store.myshopify.com')
    const second = await resolvePermanentStoreFqdn('renamed-store.myshopify.com')
    const third = await resolvePermanentStoreFqdn('abc123-xy.myshopify.com')

    // Then
    expect([first, second, third]).toEqual([
      'abc123-xy.myshopify.com',
      'abc123-xy.myshopify.com',
      'abc123-xy.myshopify.com',
    ])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test('returns the domain unchanged when meta.json is not a success', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValueOnce(metaJson({errors: 'Not Found'}, 404))

    // When
    const got = await resolvePermanentStoreFqdn('my-store.myshopify.com')

    // Then
    expect(got).toEqual('my-store.myshopify.com')
  })

  test.each([
    ['is missing', {}],
    ['is not a string', {myshopify_domain: 42}],
    ['is not a store domain', {myshopify_domain: 'evil.example.com'}],
    ['contains a path', {myshopify_domain: 'my-store.myshopify.com/admin'}],
  ])('returns the domain unchanged when myshopify_domain %s', async (_description, body) => {
    // Given
    vi.mocked(fetch).mockResolvedValueOnce(metaJson(body))

    // When
    const got = await resolvePermanentStoreFqdn('alias.myshopify.com')

    // Then
    expect(got).toEqual('alias.myshopify.com')
  })

  test('returns the domain unchanged when meta.json is not JSON', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValueOnce(new Response('<html>Challenge</html>', {status: 200}))

    // When
    const got = await resolvePermanentStoreFqdn('alias.myshopify.com')

    // Then
    expect(got).toEqual('alias.myshopify.com')
  })

  test('returns the domain unchanged when the request fails', async () => {
    // Given
    vi.mocked(fetch).mockRejectedValueOnce(new Error('The operation was aborted'))

    // When
    const got = await resolvePermanentStoreFqdn('alias.myshopify.com')

    // Then
    expect(got).toEqual('alias.myshopify.com')
  })

  test('does not look up the domain against a local development server', async () => {
    // Given
    vi.stubEnv('SHOPIFY_SERVICE_ENV', 'local')

    // When
    const got = await resolvePermanentStoreFqdn('my-store.shop.dev')

    // Then
    expect(got).toEqual('my-store.shop.dev')
    expect(fetch).not.toHaveBeenCalled()
  })
})
