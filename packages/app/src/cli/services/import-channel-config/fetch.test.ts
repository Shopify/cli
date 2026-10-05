import {fetchChannelSpecExport} from './fetch.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {ChannelSpecExportResponse} from '../../utilities/developer-platform-client.js'
import {describe, expect, test, vi} from 'vitest'

const SUCCESS_PAYLOAD = {
  success: true,
  handle: 'example',
  filename: 'example.toml',
  toml: 'handle = "example"\n',
  warnings: [],
}

function mockResponse({
  status = 200,
  json,
}: {status?: number; json?: {[key: string]: unknown}} = {}): ChannelSpecExportResponse {
  if (status >= 200 && status < 300 && json !== undefined) return {ok: true, status, body: json}
  return {ok: false, status, body: json}
}

function testOptions(response: ChannelSpecExportResponse) {
  return {
    remoteApp: testOrganizationApp({id: 'gid://shopify/App/123', organizationId: '42'}),
    developerPlatformClient: testDeveloperPlatformClient({channelSpecExport: vi.fn().mockResolvedValue(response)}),
  }
}

describe('fetchChannelSpecExport', () => {
  test('requests the export for the linked app through the developer platform client', async () => {
    // Given
    const options = testOptions(mockResponse({json: SUCCESS_PAYLOAD}))

    // When
    await fetchChannelSpecExport(options)

    // Then
    expect(options.developerPlatformClient.channelSpecExport).toHaveBeenCalledWith(options.remoteApp)
  })

  test('returns the parsed export on success', async () => {
    // Given
    const response = mockResponse({json: SUCCESS_PAYLOAD})

    // When
    const result = await fetchChannelSpecExport(testOptions(response))

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
    const response = mockResponse({
      status: 422,
      json: {success: false, error: 'not_exportable_yet', reason: 'not_allowlisted'},
    })

    // When
    const result = await fetchChannelSpecExport(testOptions(response))

    // Then
    expect(result).toEqual({success: false, reason: 'not_allowlisted'})
  })

  test('aborts with endpoint-unavailable guidance on 404', async () => {
    // Given
    const response = mockResponse({status: 404, json: {}})

    // When/Then
    await expect(fetchChannelSpecExport(testOptions(response))).rejects.toThrow(
      'The channel spec export endpoint is not available for this app.',
    )
  })

  test.each([401, 403])('aborts with re-auth guidance on %i instead of reporting an export failure', async (status) => {
    // Given
    const response = mockResponse({status, json: {}})

    // When/Then
    await expect(fetchChannelSpecExport(testOptions(response))).rejects.toThrow('authentication failed')
  })

  test('aborts with upgrade guidance on 426 instead of reporting an export failure', async () => {
    // Given
    const response = mockResponse({
      status: 426,
      json: {
        success: false,
        error: 'unsupported_client_version',
        reason: 'Shopify CLI 3.50.0 is no longer supported.',
      },
    })

    // When
    const promise = fetchChannelSpecExport(testOptions(response))

    // Then
    await expect(promise).rejects.toThrow('Shopify CLI 3.50.0 is no longer supported.')
    await expect(promise).rejects.not.toThrow('Try again in a moment')
  })

  test('aborts with retry guidance on 5xx JSON responses instead of reporting an export failure', async () => {
    // Given
    const response = mockResponse({status: 500, json: {message: 'oops'}})

    // When/Then
    await expect(fetchChannelSpecExport(testOptions(response))).rejects.toThrow('responded with status 500')
  })

  test('aborts with a controlled error when a 2xx response has no usable body', async () => {
    // Given
    const response = mockResponse({status: 200})

    // When/Then
    await expect(fetchChannelSpecExport(testOptions(response))).rejects.toThrow('responded with status 200')
  })

  test('aborts when required fields are missing from the response', async () => {
    // Given
    const response = mockResponse({json: {handle: 'example'}})

    // When/Then
    await expect(fetchChannelSpecExport(testOptions(response))).rejects.toThrow('missing required fields')
  })
})
