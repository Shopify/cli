import {getWebhookSample} from './request-sample.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners.js'

const samplePayload = '{ "sampleField": "SampleValue" }'
const sampleHeaders = '{ "header": "Header Value" }'

beforeEach(async () => {
  vi.mock('@shopify/cli-kit/node/api/partners')
  vi.mock('@shopify/cli-kit')
  vi.mock('@shopify/cli-kit/node/session')
})

afterEach(async () => {
  vi.clearAllMocks()
})

const aToken = 'A_TOKEN'

describe('getWebhookSample', () => {
  it('calls partners to request data', async () => {
    // Given
    const inputValues = {
      topic: 'A_TOPIC',
      apiVersion: 'A_VERSION',
      value: 'A_DELIVERY_METHOD',
      address: 'https://example.org',
      sharedSecret: 'A_SECRET',
    }
    const requestValues = {
      topic: inputValues.topic,
      api_version: inputValues.apiVersion,
      address: inputValues.address,
      delivery_method: inputValues.value,
      shared_secret: inputValues.sharedSecret,
    }
    const graphQLResult = {
      sendSampleWebhook: {
        samplePayload,
        headers: sampleHeaders,
        success: false,
        userErrors: [
          {message: 'Error 1', fields: ['field1']},
          {message: 'Error 2', fields: ['field1']},
        ],
      },
    }
    vi.mocked(partnersRequest).mockResolvedValue(graphQLResult)

    // When
    const got = await getWebhookSample(
      aToken,
      inputValues.topic,
      inputValues.apiVersion,
      inputValues.value,
      inputValues.address,
      inputValues.sharedSecret,
    )

    // Then
    expect(partnersRequest).toHaveBeenCalledWith(expect.any(String), 'A_TOKEN', requestValues)
    expect(got.samplePayload).toEqual(samplePayload)
    expect(got.headers).toEqual(sampleHeaders)
    expect(got.success).toEqual(graphQLResult.sendSampleWebhook.success)
    expect(got.userErrors).toEqual(graphQLResult.sendSampleWebhook.userErrors)
  })
})
