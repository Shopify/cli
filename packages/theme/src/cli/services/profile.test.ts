import {profile} from './profile.js'
import {ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'
import {openURL} from '@shopify/cli-kit/node/system'
import {vi, describe, expect, beforeEach, test} from 'vitest'
import {readFile} from 'fs/promises'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/system')

describe('profile', () => {
  const mockProfileData = {
    name: 'test-profile',
    data: 'sample-data',
  }
  const mockToken = 'mock-token'
  const storeDomain = 'test-store.myshopify.com'
  const urlPath = '/admin/themes/123/profiler'

  beforeEach(() => {
    vi.mocked(ensureAuthenticatedStorefront).mockResolvedValue(mockToken)

    // Mock fetch globally with status 200 and JSON content-type by default
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: {
        get: (name: string) => (name === 'content-type' ? 'application/json' : null),
      },
      text: () => Promise.resolve(JSON.stringify(mockProfileData)),
    })
  })

  test('outputs JSON to stdout when asJson is true', async () => {
    const stdoutWrite = vi.spyOn(process.stdout, 'write')

    await profile(undefined, storeDomain, urlPath, true)

    expect(fetch).toHaveBeenCalledWith(new URL('https://test-store.myshopify.com/admin/themes/123/profiler'), {
      headers: {
        Authorization: `Bearer ${mockToken}`,
        Accept: 'application/vnd.speedscope+json',
      },
    })
    expect(stdoutWrite).toHaveBeenCalledWith(JSON.stringify(mockProfileData))
  })

  test('opens profile in browser when asJson is false', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: {
        get: (name: string) => (name === 'content-type' ? 'application/json' : null),
      },
      text: () => Promise.resolve(JSON.stringify(mockProfileData)),
    })

    await profile(undefined, storeDomain, urlPath, false)

    // Verify fetch was called correctly
    expect(fetch).toHaveBeenCalled()

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

  test('uses provided password for authentication', async () => {
    const password = 'test-password'
    await profile(password, storeDomain, urlPath, true)

    expect(ensureAuthenticatedStorefront).toHaveBeenCalledWith([], password)
  })

  test('throws error when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(profile(undefined, storeDomain, urlPath, true)).rejects.toThrow('Network error')
  })

  test('throws error when response status is not 200 and content-type is not application/json', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 404,
      headers: {
        get: (name: string) => (name === 'content-type' ? 'text/html' : null),
      },
    })

    await expect(profile(undefined, storeDomain, urlPath, true)).rejects.toThrow(
      'Bad response: 404, content-type: text/html',
    )
  })

  test('succeeds when status is not 200 but content-type is application/json', async () => {
    const jsonResponse = {error: 'Some error message'}
    global.fetch = vi.fn().mockResolvedValue({
      status: 404,
      headers: {
        get: (name: string) => (name === 'content-type' ? 'application/json' : null),
      },
      text: () => Promise.resolve(JSON.stringify(jsonResponse)),
    })

    // Mock stdout.write
    const stdoutWrite = vi.spyOn(process.stdout, 'write')

    await profile(undefined, storeDomain, urlPath, true)

    expect(stdoutWrite).toHaveBeenCalledWith(JSON.stringify(jsonResponse))
  })
})
