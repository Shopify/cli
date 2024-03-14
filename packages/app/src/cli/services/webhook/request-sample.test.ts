import {SendSampleWebhookVariables, getWebhookSample} from './request-sample.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

const inputValues: SendSampleWebhookVariables = {
  topic: 'A_TOPIC',
  api_version: 'A_VERSION',
  delivery_method: 'A_DELIVERY_METHOD',
  address: 'https://example.org',
  shared_secret: 'A_SECRET',
}
describe('getWebhookSample', () => {
  test('calls partners to request data without api-key', async () => {
    // Given/When
    const got = await getWebhookSample(testDeveloperPlatformClient(), inputValues)

    // Then
    expect(got.samplePayload).toEqual('{ "sampleField": "SampleValue" }')
    expect(got.headers).toEqual('{ "header": "Header Value" }')
    expect(got.success).toEqual(true)
    expect(got.userErrors).toEqual([])
  })

  test('calls partners to request data with api-key', async () => {
    // Given
    const variables: SendSampleWebhookVariables = {
      ...inputValues,
      api_key: 'api-key',
    }

    // When
    const got = await getWebhookSample(testDeveloperPlatformClient(), variables)

    // Then
    expect(got.samplePayload).toEqual('{ "sampleField": "SampleValue" }')
    expect(got.headers).toEqual('{ "header": "Header Value" }')
    expect(got.success).toEqual(true)
    expect(got.userErrors).toEqual([])
  })
})
