import {triggerLocalEvent} from './trigger-local-event.js'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {http} from '@shopify/cli-kit'

const samplePayload = '{ "sampleField": "SampleValue" }'
const sampleHeaders = '{ "header": "Header Value" }'

beforeEach(async () => {
  vi.mock('@shopify/cli-kit')
})

afterEach(async () => {
  vi.clearAllMocks()
})

describe('triggerLocalEvent', () => {
  it('delivers to localhost port', async () => {
    // Given
    const successResponse: any = {status: 200}
    vi.mocked(http.fetch).mockResolvedValue(successResponse)
    const fetchSpy = vi.spyOn(http, 'fetch')

    // When
    const got = await triggerLocalEvent('http://localhost:1234/a/url/path', samplePayload, sampleHeaders)

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

  it('notifies failure to deliver to localhost port', async () => {
    // Given
    const errorResponse: any = {status: 500}
    vi.mocked(http.fetch).mockResolvedValue(errorResponse)
    const fetchSpy = vi.spyOn(http, 'fetch')

    // When
    const got = await triggerLocalEvent('http://localhost:1234/api/webhooks', samplePayload, sampleHeaders)

    // Then
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(got).toBeFalsy()
  })
})
