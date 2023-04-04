import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {describe, expect, vi, test} from 'vitest'
import * as http from '@shopify/cli-kit/node/http'

const samplePayload = '{ "sampleField": "SampleValue" }'
const sampleHeaders = '{ "header": "Header Value" }'

vi.mock('@shopify/cli-kit/node/http')

describe('triggerLocalWebhook', () => {
  test('delivers to localhost port', async () => {
    // Given
    const successResponse: any = {status: 200}
    vi.mocked(http.fetch).mockResolvedValue(successResponse)
    const fetchSpy = vi.spyOn(http, 'fetch')

    // When
    const got = await triggerLocalWebhook('http://localhost:1234/a/url/path', samplePayload, sampleHeaders)

    // Then
    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:1234/a/url/path', {
      method: 'POST',
      body: samplePayload,
      headers: {
        'Content-Type': 'application/json',
        ...JSON.parse(sampleHeaders),
      },
    })
    expect(got).toBeTruthy()
  })

  test('notifies failure to deliver to localhost port', async () => {
    // Given
    const errorResponse: any = {status: 500}
    vi.mocked(http.fetch).mockResolvedValue(errorResponse)
    const fetchSpy = vi.spyOn(http, 'fetch')

    // When
    const got = await triggerLocalWebhook('http://localhost:1234/api/webhooks', samplePayload, sampleHeaders)

    // Then
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(got).toBeFalsy()
  })
})
