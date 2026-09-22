import {fetchChannelSpecExport} from './fetch.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'
import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'

vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/context/fqdn')

const SUCCESS_PAYLOAD = {
  success: true,
  handle: 'example',
  filename: 'example.toml',
  toml: 'handle = "example"\n',
  warnings: [],
}

function mockResponse({status = 200, json}: {status?: number; json?: unknown} = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: json === undefined ? () => Promise.reject(new Error('invalid json')) : () => Promise.resolve(json),
  } as unknown as Awaited<ReturnType<typeof shopifyFetch>>
}

function testOptions() {
  return {
    remoteApp: testOrganizationApp({id: 'gid://shopify/App/123', organizationId: '42'}),
    developerPlatformClient: testDeveloperPlatformClient(),
  }
}

describe('fetchChannelSpecExport', () => {
  test('extracts the numeric app id from a GID when building the endpoint URL', async () => {
    // Given
    vi.mocked(appManagementFqdn).mockResolvedValue('app.shopify.com')
    vi.mocked(shopifyFetch).mockResolvedValue(mockResponse({json: SUCCESS_PAYLOAD}))

    // When
    await fetchChannelSpecExport(testOptions())

    // Then
    expect(shopifyFetch).toHaveBeenCalledWith(
      'https://app.shopify.com/app_management/unstable/organizations/42/apps/123/channel_spec_export.json',
      expect.anything(),
    )
  })

  test('returns the parsed export on success', async () => {
    // Given
    vi.mocked(appManagementFqdn).mockResolvedValue('app.shopify.com')
    vi.mocked(shopifyFetch).mockResolvedValue(mockResponse({json: SUCCESS_PAYLOAD}))

    // When
    const result = await fetchChannelSpecExport(testOptions())

    // Then
    expect(result).toEqual({
      success: true,
      handle: 'example',
      filename: 'example.toml',
      toml: 'handle = "example"\n',
      warnings: [],
    })
  })

  test('treats a 422 as a well-formed export failure with a reason', async () => {
    // Given
    vi.mocked(appManagementFqdn).mockResolvedValue('app.shopify.com')
    vi.mocked(shopifyFetch).mockResolvedValue(
      mockResponse({status: 422, json: {success: false, error: 'not_exportable_yet', reason: 'not_allowlisted'}}),
    )

    // When
    const result = await fetchChannelSpecExport(testOptions())

    // Then
    expect(result).toEqual({success: false, reason: 'not_allowlisted'})
  })

  test('aborts with endpoint-unavailable guidance on 404', async () => {
    // Given
    vi.mocked(appManagementFqdn).mockResolvedValue('app.shopify.com')
    vi.mocked(shopifyFetch).mockResolvedValue(mockResponse({status: 404, json: {}}))

    // When/Then
    await expect(fetchChannelSpecExport(testOptions())).rejects.toThrow(
      'The channel spec export endpoint is not available for this app.',
    )
  })

  test.each([401, 403])('aborts with re-auth guidance on %i instead of reporting an export failure', async (status) => {
    // Given
    vi.mocked(appManagementFqdn).mockResolvedValue('app.shopify.com')
    vi.mocked(shopifyFetch).mockResolvedValue(mockResponse({status, json: {}}))

    // When/Then
    await expect(fetchChannelSpecExport(testOptions())).rejects.toThrow('authentication failed')
  })

  test('aborts with upgrade guidance on 426 instead of reporting an export failure', async () => {
    // Given
    vi.mocked(appManagementFqdn).mockResolvedValue('app.shopify.com')
    vi.mocked(shopifyFetch).mockResolvedValue(
      mockResponse({
        status: 426,
        json: {
          success: false,
          error: 'unsupported_client_version',
          reason: 'Shopify CLI 3.50.0 is no longer supported.',
        },
      }),
    )

    // When
    const promise = fetchChannelSpecExport(testOptions())

    // Then
    await expect(promise).rejects.toThrow('Shopify CLI 3.50.0 is no longer supported.')
    await expect(promise).rejects.not.toThrow('likely temporary')
  })

  test('aborts with retry guidance on 5xx JSON responses instead of reporting an export failure', async () => {
    // Given
    vi.mocked(appManagementFqdn).mockResolvedValue('app.shopify.com')
    vi.mocked(shopifyFetch).mockResolvedValue(mockResponse({status: 500, json: {message: 'oops'}}))

    // When/Then
    await expect(fetchChannelSpecExport(testOptions())).rejects.toThrow('responded with status 500')
  })

  test.each([
    ['null', null],
    ['an array', ['not', 'an', 'object']],
    ['a primitive', 'nope'],
  ])('aborts with a controlled error when the body is %s', async (_label, json) => {
    // Given
    vi.mocked(appManagementFqdn).mockResolvedValue('app.shopify.com')
    vi.mocked(shopifyFetch).mockResolvedValue(mockResponse({json}))

    // When/Then
    await expect(fetchChannelSpecExport(testOptions())).rejects.toThrow('unexpected response')
  })

  test('aborts when required fields are missing from the response', async () => {
    // Given
    vi.mocked(appManagementFqdn).mockResolvedValue('app.shopify.com')
    vi.mocked(shopifyFetch).mockResolvedValue(mockResponse({json: {handle: 'example'}}))

    // When/Then
    await expect(fetchChannelSpecExport(testOptions())).rejects.toThrow('missing required fields')
  })
})
