import {getWebhookSample} from './request-sample.js'
import {describe, expect, vi, test} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

const samplePayload = '{ "sampleField": "SampleValue" }'
const sampleHeaders = '{ "header": "Header Value" }'

vi.mock('@shopify/cli-kit/node/api/partners')

const aToken = 'A_TOKEN'
const anApiKey = 'AN_API_KEY'
const inputValues = {
  topic: 'A_TOPIC',
  apiVersion: 'A_VERSION',
  value: 'A_DELIVERY_METHOD',
  address: 'https://example.org',
  clientSecret: 'A_SECRET',
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

describe('getWebhookSample', () => {
  test('calls partners to request data without api-key', async () => {
    // Given
    const requestValues = {
      topic: inputValues.topic,
      api_version: inputValues.apiVersion,
      address: inputValues.address,
      delivery_method: inputValues.value,
      shared_secret: inputValues.clientSecret,
    }
    vi.mocked(partnersRequest).mockResolvedValue(graphQLResult)

    // When
    const got = await getWebhookSample(
      aToken,
      inputValues.topic,
      inputValues.apiVersion,
      inputValues.value,
      inputValues.address,
      inputValues.clientSecret,
    )

    // Then
    expect(partnersRequest).toHaveBeenCalledWith(expect.any(String), 'A_TOKEN', requestValues)
    expect(got.samplePayload).toEqual(samplePayload)
    expect(got.headers).toEqual(sampleHeaders)
    expect(got.success).toEqual(graphQLResult.sendSampleWebhook.success)
    expect(got.userErrors).toEqual(graphQLResult.sendSampleWebhook.userErrors)
  })

  test('calls partners to request data with api-key', async () => {
    // Given
    const requestValues = {
      topic: inputValues.topic,
      api_version: inputValues.apiVersion,
      address: inputValues.address,
      delivery_method: inputValues.value,
      shared_secret: inputValues.clientSecret,
      api_key: anApiKey,
    }
    vi.mocked(partnersRequest).mockResolvedValue(graphQLResult)

    // When
    const got = await getWebhookSample(
      aToken,
      inputValues.topic,
      inputValues.apiVersion,
      inputValues.value,
      inputValues.address,
      inputValues.clientSecret,
      anApiKey,
    )

    // Then
    expect(partnersRequest).toHaveBeenCalledWith(expect.any(String), 'A_TOKEN', requestValues)
    expect(got.samplePayload).toEqual(samplePayload)
    expect(got.headers).toEqual(sampleHeaders)
    expect(got.success).toEqual(graphQLResult.sendSampleWebhook.success)
    expect(got.userErrors).toEqual(graphQLResult.sendSampleWebhook.userErrors)
  })
})
