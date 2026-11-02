import {profile} from './profile.js'
import {renderThemeProfileResult} from './profile/result.js'
import {render} from '../utilities/theme-environment/storefront-renderer.js'
import {ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'
import {openURL} from '@shopify/cli-kit/node/system'
import {vi, describe, expect, beforeEach, afterEach, test} from 'vitest'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

import {readFile} from 'fs/promises'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('../utilities/theme-environment/storefront-password-prompt.js')
vi.mock('../utilities/theme-environment/storefront-session.js')
vi.mock('../utilities/theme-environment/storefront-renderer.js')
// Session setup must not request crawler signatures from the Admin API in these unit tests.
vi.mock('../utilities/theme-environment/crawler-signature.js')

describe('profile', () => {
  const mockProfileData = {
    name: 'test-profile',
    $schema: 'https://www.speedscope.app/file-format-schema.json',
    profiles: [],
    shared: {frames: []},
  }
  const mockToken = 'mock-token'
  const mockAdminSession = {token: mockToken, storeFqdn: 'test-store.myshopify.com'}
  const themeId = '123'
  const urlPath = '/products/test'

  beforeEach(() => {
    vi.mocked(ensureAuthenticatedStorefront).mockResolvedValue(mockToken)
    vi.mocked(render).mockResolvedValue(
      new Response(JSON.stringify(mockProfileData), {
        status: 200,
        headers: new Headers({
          'content-type': 'application/json',
        }),
      }),
    )
  })

  test('outputs JSON to stdout when asJson is true', async () => {
    // When
    const result = await profile(mockAdminSession, themeId, urlPath)
    expect(result.result).toEqual(mockProfileData)
    await renderThemeProfileResult(result, 'json')

    // Then
    expect(render).toHaveBeenCalledWith(
      {
        sessionCookies: undefined,
        storefrontToken: mockToken,
      },
      {
        method: 'GET',
        path: urlPath,
        query: [],
        themeId,
        headers: {
          Accept: 'application/vnd.speedscope+json',
        },
      },
    )
    expect(outputResult).toHaveBeenCalledWith(JSON.stringify(mockProfileData))
  })

  test('opens profile in browser when asJson is false', async () => {
    // When
    await renderThemeProfileResult(await profile(mockAdminSession, themeId, urlPath), 'text')

    // Then
    // Verify fetch was called correctly
    expect(render).toHaveBeenCalled()

    // Verify openURL was called with a file:// URL
    expect(openURL).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/.*\.html$/))

    // Verify the generated files
    const openUrlCalls = vi.mocked(openURL).mock.calls
    expect(openUrlCalls.length).toBeGreaterThan(0)
    const firstCall = openUrlCalls[0]
    if (!firstCall) throw new Error('Expected at least one openURL call')
    const htmlPath = firstCall[0].replace('file://', '')
    const htmlContent = await readFile(htmlPath, 'utf8')

    expect(htmlContent).toContain('window.location')
    expect(htmlContent).toContain('speedscope')
  })

  test.each([-1, 0.5])('opens native profiles with source position %s', async (position) => {
    const data = {...mockProfileData, shared: {frames: [{name: 'layout', line: position, col: position}]}}
    vi.mocked(render).mockResolvedValue(new Response(JSON.stringify(data), {status: 200}))

    const result = await profile(mockAdminSession, themeId, urlPath)
    expect(result.result).toEqual(data)
    await renderThemeProfileResult(result, 'text')

    expect(openURL).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/.*\.html$/))
  })

  test('throws error when fetch fails', async () => {
    // Given
    vi.mocked(render).mockRejectedValue(new Error('Network error'))

    // When
    const result = profile(mockAdminSession, themeId, urlPath)

    // Then
    await expect(result).rejects.toThrow('Network error')
  })

  test('passes the query string of the url separately from the path', async () => {
    // When
    await profile(mockAdminSession, themeId, '/search?q=kw&page=2#results')

    // Then
    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: '/search',
        query: [
          ['q', 'kw'],
          ['page', '2'],
        ],
      }),
    )
  })

  test('does not let the url override the storefront renderer query params', async () => {
    // When
    await profile(mockAdminSession, themeId, '/collections/all?_fd=1&pb=1&page=2')

    // Then
    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({path: '/collections/all', query: [['page', '2']]}),
    )
  })

  test('uses only the path and query of an absolute url', async () => {
    // When
    await profile(mockAdminSession, themeId, 'https://custom-domain.com/products/test?variant=1')

    // Then
    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({path: '/products/test', query: [['variant', '1']]}),
    )
  })

  test.each(['//products/test', 'https://'])('reports %s as an invalid url', async (url) => {
    // When
    const result = profile(mockAdminSession, themeId, url)

    // Then
    await expect(result).rejects.toThrow(
      new AbortError(
        `${url} isn't a valid storefront URL.`,
        'Pass the path of a storefront page to --url, for example /products/classic-leather-jacket.',
      ),
    )
    expect(render).not.toHaveBeenCalled()
  })

  test('suggests the redirect destination when the page redirects within the storefront', async () => {
    // Given
    vi.mocked(render).mockResolvedValue(new Response(null, {status: 301, headers: {Location: '/pages/new?_fd=0&pb=0'}}))

    // When
    const result = profile(mockAdminSession, themeId, urlPath)

    // Then
    await expect(result).rejects.toThrow(
      new AbortError(
        `The page ${urlPath} redirects (301) instead of rendering, so it can't be profiled.`,
        'It redirects to /pages/new. Run the command again with --url "/pages/new".',
      ),
    )
  })

  test('shows the full redirect destination when the page redirects to another host', async () => {
    // Given
    vi.mocked(render).mockResolvedValue(
      new Response(null, {
        status: 301,
        headers: {Location: 'https://custom-domain.com/de/pages/x?_fd=0&pb=0&view=full'},
      }),
    )

    // When
    const result = profile(mockAdminSession, themeId, urlPath)

    // Then
    await expect(result).rejects.toThrow(
      new AbortError(
        `The page ${urlPath} redirects (301) instead of rendering, so it can't be profiled.`,
        'It redirects to https://custom-domain.com/de/pages/x?view=full. If that page is on your storefront, run the command again with --url "/de/pages/x?view=full".',
      ),
    )
  })

  test('does not suggest the same url when the page redirects to the same path', async () => {
    // Given
    vi.mocked(render).mockResolvedValue(
      new Response(null, {status: 301, headers: {Location: `https://custom-domain.com${urlPath}?_fd=0&pb=0`}}),
    )

    // When
    const result = profile(mockAdminSession, themeId, urlPath)

    // Then
    await expect(result).rejects.toThrow(
      new AbortError(
        `The page ${urlPath} redirects (301) instead of rendering, so it can't be profiled.`,
        `It redirects to https://custom-domain.com${urlPath}.`,
      ),
    )
  })

  test('suggests the storefront password when the page redirects to the password page', async () => {
    // Given
    vi.mocked(render).mockResolvedValue(new Response(null, {status: 302, headers: {Location: '/password'}}))

    // When
    const result = profile(mockAdminSession, themeId, '/')

    // Then
    await expect(result).rejects.toThrow(
      new AbortError(
        "The page / redirects (302) instead of rendering, so it can't be profiled.",
        'It redirects to the storefront password page. Check the storefront password, and pass it with --store-password.',
      ),
    )
  })

  test('reports a redirect without a location as an expected error', async () => {
    // Given
    vi.mocked(render).mockResolvedValue(new Response(null, {status: 301}))

    // When
    const result = profile(mockAdminSession, themeId, urlPath)

    // Then
    await expect(result).rejects.toThrow(
      new AbortError(`The page ${urlPath} redirects (301) instead of rendering, so it can't be profiled.`),
    )
  })

  test('reports a non-200 response as an expected error', async () => {
    // Given
    vi.mocked(render).mockResolvedValue(
      new Response(JSON.stringify({error: 'Some error message'}), {
        status: 404,
        headers: new Headers({'content-type': 'application/json', 'x-request-id': 'request-id'}),
      }),
    )

    // When
    const result = profile(mockAdminSession, themeId, urlPath)

    // Then
    await expect(result).rejects.toThrow(
      new AbortError(
        `Can't profile ${urlPath}. The storefront responded with 404.\nRequest ID: request-id\n{"error":"Some error message"}`,
      ),
    )
  })

  test('does not include a long non-JSON response body in the error', async () => {
    // Given
    const htmlPage = `<html><body>${'Server error. '.repeat(20)}</body></html>`
    vi.mocked(render).mockResolvedValue(new Response(htmlPage, {status: 500}))

    // When
    const result = profile(mockAdminSession, themeId, urlPath)

    // Then
    await expect(result).rejects.toThrow(new AbortError(`Can't profile ${urlPath}. The storefront responded with 500.`))
  })

  test('throws error when a password is used', async () => {
    // When
    const result = profile(mockAdminSession, themeId, urlPath, 'shpat_hello')

    // Then
    await expect(result).rejects.toThrow(
      new AbortError(
        'Unable to use Admin API or Theme Access tokens with the profile command',
        'You must authenticate manually by not passing the --password flag.',
      ),
    )
  })

  describe('WSL path conversion', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    test('converts paths to WSL format when WSL_DISTRO_NAME is set', async () => {
      // Given
      vi.stubEnv('WSL_DISTRO_NAME', 'Ubuntu')
      vi.mocked(openURL).mockResolvedValue(true)

      // When
      await renderThemeProfileResult(await profile(mockAdminSession, themeId, urlPath), 'text')

      // Then
      expect(openURL).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/\/wsl\$\/Ubuntu.*\.html$/))
    })

    test('does not convert paths when WSL_DISTRO_NAME is not set', async () => {
      // Given
      vi.stubEnv('WSL_DISTRO_NAME', '')
      vi.mocked(openURL).mockResolvedValue(true)

      // When
      await renderThemeProfileResult(await profile(mockAdminSession, themeId, urlPath), 'text')

      // Then
      expect(openURL).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/.*\.html$/))
    })
  })
})
