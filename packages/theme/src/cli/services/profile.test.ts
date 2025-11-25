import {profile} from './profile.js'
import {render} from '../utilities/theme-environment/storefront-renderer.js'
import {ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'
import {openURL} from '@shopify/cli-kit/node/system'
import {vi, describe, expect, beforeEach, test} from 'vitest'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile} from 'fs/promises'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('../utilities/theme-environment/storefront-password-prompt.js')
vi.mock('../utilities/theme-environment/storefront-session.js')
vi.mock('../utilities/theme-environment/storefront-renderer.js')

describe('profile', () => {
  const mockProfileData = {
    name: 'test-profile',
    data: 'sample-data',
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
    await profile(mockAdminSession, themeId, urlPath, true, undefined, undefined)

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
    await profile(mockAdminSession, themeId, urlPath, false, undefined, undefined)

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

  test('uses provided passwords for authentication', async () => {
    // When
    await profile(mockAdminSession, themeId, urlPath, true, 'themeAccessPassword', 'storePassword')

    // Then
    expect(ensureAuthenticatedStorefront).toHaveBeenCalledWith([], 'themeAccessPassword', {
      forceRefresh: false,
      noPrompt: true,
    })
  })

  test('throws error when fetch fails', async () => {
    // Given
    vi.mocked(render).mockRejectedValue(new Error('Network error'))

    // When
    const result = profile(mockAdminSession, themeId, urlPath, true, undefined, undefined)

    // Then
    await expect(result).rejects.toThrow('Network error')
  })

  test('throws error when response status is not 200', async () => {
    // Given
    vi.mocked(render).mockResolvedValue(
      new Response(JSON.stringify({error: 'Some error message'}), {
        status: 404,
        headers: new Headers({'content-type': 'application/json'}),
      }),
    )

    // When
    const result = profile(mockAdminSession, themeId, urlPath, true, undefined, undefined)

    // Then
    await expect(result).rejects.toThrow('Bad response: 404: {"error":"Some error message"}')
  })

  test('throws error when an Admin API token is used', async () => {
    // When
    const result = profile(mockAdminSession, themeId, urlPath, true, 'shpat_hello', undefined)

    // Then
    await expect(result).rejects.toThrow(
      new AbortError(
        'Unable to use Admin API or Theme Access tokens with the profile command',
        'You can authenticate normally by not passing the --password flag.',
      ),
    )
  })
})
