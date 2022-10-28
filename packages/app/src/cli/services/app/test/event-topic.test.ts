import {requestSample, sendLocal, collectCliOptions, TestWebhookOptions, TestWebhookFlags} from './event-topic.js'
import {
  addressPrompt,
  apiVersionPrompt,
  deliveryMethodPrompt,
  localPortPrompt,
  localUrlPathPrompt,
  sharedSecretPrompt,
  topicPrompt,
} from '../../../prompts/test/event-topic.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {api, http, session} from '@shopify/cli-kit'

const samplePayload = '{ "sampleField": "SampleValue" }'
const sampleHeaders = '{ "header": "Header Value" }'
const aTopic = 'A_TOPIC'
const aVersion = 'A_VERSION'
const aSecret = 'A_SECRET'
const aPort = '1234'
const aUrlPath = '/a/url/path'
const anAddress = 'http://example.org'
const aLocalAddress = 'http://localhost'
const env = process.env

beforeEach(async () => {
  vi.mock('@shopify/cli-kit')
})

afterEach(async () => {
  vi.clearAllMocks()
})

describe('requestSample', () => {
  beforeEach(async () => {
    vi.mocked(session.ensureAuthenticatedPartners).mockResolvedValue('A_TOKEN')
  })

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
    vi.mocked(api.partners.request).mockResolvedValue(graphQLResult)

    const requestSpy = vi.spyOn(api.partners, 'request')
    const sessionSpy = vi.spyOn(session, 'ensureAuthenticatedPartners')

    // When
    const got = await requestSample(
      inputValues.topic,
      inputValues.apiVersion,
      inputValues.value,
      inputValues.address,
      inputValues.sharedSecret,
    )

    // Then
    expect(sessionSpy).toHaveBeenCalledOnce()
    expect(requestSpy).toHaveBeenCalledWith(expect.any(String), 'A_TOKEN', requestValues)
    expect(got.samplePayload).toEqual(samplePayload)
    expect(got.headers).toEqual(sampleHeaders)
    expect(got.success).toEqual(graphQLResult.sendSampleWebhook.success)
    expect(got.userErrors).toEqual(graphQLResult.sendSampleWebhook.userErrors)
  })
})

describe('sendLocal', () => {
  it('delivers to localhost port', async () => {
    // Given
    const successResponse: any = {status: 200}
    vi.mocked(http.fetch).mockResolvedValue(successResponse)
    const fetchSpy = vi.spyOn(http, 'fetch')

    // When
    const got = await sendLocal('http://localhost:1234/a/url/path', samplePayload, sampleHeaders)

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
    const got = await sendLocal('http://localhost:1234/api/webhooks', samplePayload, sampleHeaders)

    // Then
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(got).toBeFalsy()
  })
})

describe('collectCliOptions', () => {
  beforeEach(async () => {
    vi.mock('../../../prompts/test/event-topic.js')

    process.env = {
      ...env,
      SHOPIFY_FLAG_SHARED_SECRET: undefined,
    }
  })

  afterEach(async () => {
    process.env = env
  })
  describe('without params', () => {
    beforeEach(async () => {
      vi.mocked(topicPrompt).mockResolvedValue(aTopic)
      vi.mocked(apiVersionPrompt).mockResolvedValue(aVersion)
      vi.mocked(sharedSecretPrompt).mockResolvedValue(aSecret)
    })

    it('collects HTTP localhost params', async () => {
      // Given
      vi.mocked(deliveryMethodPrompt).mockResolvedValue('http')
      vi.mocked(addressPrompt).mockResolvedValue(aLocalAddress)
      vi.mocked(localPortPrompt).mockResolvedValue(aPort)
      vi.mocked(localUrlPathPrompt).mockResolvedValue(aUrlPath)

      // When
      const options = await collectCliOptions({})

      // Then
      const expected: TestWebhookOptions = {
        topic: aTopic,
        apiVersion: aVersion,
        sharedSecret: aSecret,
        deliveryMethod: 'localhost',
        localhostPort: aPort,
        localhostUrlPath: aUrlPath,
        address: `${aLocalAddress}:${aPort}${aUrlPath}`,
      }
      expect(options).toEqual(expected)
      expectBasicPromptsToHaveBeenCalledOnce()
      expect(addressPrompt).toHaveBeenCalledOnce()
      expect(localPortPrompt).toHaveBeenCalledOnce()
      expect(localUrlPathPrompt).toHaveBeenCalledOnce()
    })

    it('collects HTTP remote delivery params', async () => {
      // Given
      vi.mocked(deliveryMethodPrompt).mockResolvedValue('http')
      vi.mocked(addressPrompt).mockResolvedValue(anAddress)
      vi.mocked(localPortPrompt)
      vi.mocked(localUrlPathPrompt)

      // When
      const options = await collectCliOptions({})

      // Then
      const expected: TestWebhookOptions = {
        topic: aTopic,
        apiVersion: aVersion,
        sharedSecret: aSecret,
        deliveryMethod: 'http',
        localhostPort: '',
        localhostUrlPath: '',
        address: anAddress,
      }
      expect(options).toEqual(expected)
      expectBasicPromptsToHaveBeenCalledOnce()
      expect(addressPrompt).toHaveBeenCalledOnce()
      expect(localPortPrompt).toHaveBeenCalledTimes(0)
      expect(localUrlPathPrompt).toHaveBeenCalledTimes(0)
    })

    function expectBasicPromptsToHaveBeenCalledOnce() {
      expect(topicPrompt).toHaveBeenCalledOnce()
      expect(apiVersionPrompt).toHaveBeenCalledOnce()
      expect(sharedSecretPrompt).toHaveBeenCalledOnce()
      expect(deliveryMethodPrompt).toHaveBeenCalledOnce()
    }
  })

  describe('with params', () => {
    beforeEach(async () => {
      vi.mocked(topicPrompt)
      vi.mocked(apiVersionPrompt)
      vi.mocked(sharedSecretPrompt)
      vi.mocked(deliveryMethodPrompt)
      vi.mocked(addressPrompt)
      vi.mocked(localPortPrompt)
      vi.mocked(localUrlPathPrompt)

      process.env = {
        ...env,
        SHOPIFY_FLAG_SHARED_SECRET: 'A_SECRET',
      }
    })

    it('collects localhost delivery method required params', async () => {
      // Given
      const flags: TestWebhookFlags = {
        topic: aTopic,
        apiVersion: aVersion,
        deliveryMethod: 'http',
        address: `${aLocalAddress}:8080/anything`,
        port: aPort,
        urlPath: aUrlPath,
      }

      // When
      const options = await collectCliOptions(flags)

      // Then
      const expected: TestWebhookOptions = {
        topic: aTopic,
        apiVersion: aVersion,
        sharedSecret: aSecret,
        deliveryMethod: 'localhost',
        localhostPort: aPort,
        localhostUrlPath: aUrlPath,
        address: `${aLocalAddress}:${aPort}${aUrlPath}`,
      }
      expect(options).toEqual(expected)
      expectNoPrompts()
    })

    it('collects remote delivery method required params', async () => {
      // Given
      const flags: TestWebhookFlags = {
        topic: aTopic,
        apiVersion: aVersion,
        deliveryMethod: 'http',
        address: anAddress,
      }

      // When
      const options = await collectCliOptions(flags)

      // Then
      const expected: TestWebhookOptions = {
        topic: aTopic,
        apiVersion: aVersion,
        sharedSecret: aSecret,
        deliveryMethod: 'http',
        localhostPort: '',
        localhostUrlPath: '',
        address: anAddress,
      }
      expect(options).toEqual(expected)
      expectNoPrompts()
    })

    function expectNoPrompts() {
      expect(topicPrompt).toHaveBeenCalledTimes(0)
      expect(apiVersionPrompt).toHaveBeenCalledTimes(0)
      expect(sharedSecretPrompt).toHaveBeenCalledTimes(0)
      expect(deliveryMethodPrompt).toHaveBeenCalledTimes(0)
      expect(addressPrompt).toHaveBeenCalledTimes(0)
      expect(localPortPrompt).toHaveBeenCalledTimes(0)
      expect(localUrlPathPrompt).toHaveBeenCalledTimes(0)
    }
  })
})
