import {webhookTriggerService} from './trigger.js'
import {getWebhookSample} from './request-sample.js'
import {requestApiVersions} from './request-api-versions.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {requestTopics} from './request-topics.js'
import {findInEnv, findApiKey, requestAppInfo} from './find-app-info.js'
import {
  collectAddressAndMethod,
  collectApiVersion,
  collectSecret,
  collectTopic,
  WebhookTriggerFlags,
} from '../../prompts/webhook/options-prompt.js'
import {outputInfo, outputSuccess, consoleError} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

const aToken = 'A_TOKEN'
const samplePayload = '{ "sampleField": "SampleValue" }'
const sampleHeaders = '{ "header": "Header Value" }'
const aTopic = 'A_TOPIC'
const aVersion = 'A_VERSION'
const aSecret = 'A_SECRET'
const aPort = '1234'
const aUrlPath = '/a/url/path'
const anAddress = 'https://example.org'

beforeEach(async () => {
  vi.mock('@shopify/cli-kit')
  vi.mock('@shopify/cli-kit/node/output')
  vi.mock('@shopify/cli-kit/node/session')
  vi.mock('../../prompts/webhook/options-prompt.js')
  vi.mock('./request-sample.js')
  vi.mock('./request-api-versions.js')
  vi.mock('./request-topics.js')
  vi.mock('./trigger-local-webhook.js')
})

afterEach(async () => {
  vi.clearAllMocks()
})

const emptyJson = '{}'
const successDirectResponse = {
  samplePayload,
  headers: sampleHeaders,
  success: true,
  userErrors: [],
}
const successEmptyResponse = {
  samplePayload: emptyJson,
  headers: emptyJson,
  success: true,
  userErrors: [],
}
const aFullLocalAddress = `http://localhost:${aPort}${aUrlPath}`

describe('webhookTriggerService', () => {
  beforeEach(async () => {
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue(aToken)
  })

  it('notifies about request errors', async () => {
    // Given
    const response = {
      samplePayload: emptyJson,
      headers: emptyJson,
      success: false,
      userErrors: [
        {message: '["Some error"]', fields: ['field1']},
        {message: '["Another error"]', fields: ['field2']},
      ],
    }
    mockParams(aVersion, aTopic, 'http', anAddress, aSecret)

    vi.mocked(getWebhookSample).mockResolvedValue(response)

    // When
    await webhookTriggerService(sampleFlags())

    // Then
    expectCalls(aVersion)
    expect(consoleError).toHaveBeenCalledWith(`Request errors:\n  · Some error\n  · Another error`)
  })

  it('Safe notification in case of unexpected request errors', async () => {
    // Given
    const response = {
      samplePayload: emptyJson,
      headers: emptyJson,
      success: false,
      userErrors: [
        {message: 'Something not JSON', fields: ['field1']},
        {message: 'Another invalid JSON', fields: ['field2']},
      ],
    }
    mockParams(aVersion, aTopic, 'http', anAddress, aSecret)

    vi.mocked(getWebhookSample).mockResolvedValue(response)

    // When
    await webhookTriggerService(sampleFlags())

    // Then
    expectCalls(aVersion)
    expect(consoleError).toHaveBeenCalledWith(`Request errors:\n${JSON.stringify(response.userErrors)}`)
  })

  it('notifies about real delivery being sent', async () => {
    // Given
    mockParams(aVersion, aTopic, 'http', anAddress, aSecret)

    vi.mocked(triggerLocalWebhook)
    vi.mocked(getWebhookSample).mockResolvedValue(successEmptyResponse)

    // When
    await webhookTriggerService(sampleFlags())

    // Then
    expectCalls(aVersion)
    expect(getWebhookSample).toHaveBeenCalledWith(aToken, aTopic, aVersion, 'http', anAddress, aSecret)
    expect(triggerLocalWebhook).toHaveBeenCalledTimes(0)
    expect(outputSuccess).toHaveBeenCalledWith('Webhook has been enqueued for delivery')
  })

  describe('Localhost delivery', () => {
    it('delivers to localhost', async () => {
      // Given
      mockParams(aVersion, aTopic, 'localhost', aFullLocalAddress, aSecret)

      vi.mocked(triggerLocalWebhook).mockResolvedValue(true)
      vi.mocked(getWebhookSample).mockResolvedValue(successDirectResponse)

      // When
      await webhookTriggerService(sampleFlags())

      // Then
      expectCalls(aVersion)
      expect(getWebhookSample).toHaveBeenCalledWith(aToken, aTopic, aVersion, 'localhost', aFullLocalAddress, aSecret)
      expect(triggerLocalWebhook).toHaveBeenCalledWith(aFullLocalAddress, samplePayload, sampleHeaders)
      expect(outputSuccess).toHaveBeenCalledWith('Localhost delivery sucessful')
    })

    it('shows an error if localhost is not ready', async () => {
      // Given
      mockParams(aVersion, aTopic, 'localhost', aFullLocalAddress, aSecret)

      vi.mocked(triggerLocalWebhook).mockResolvedValue(false)
      vi.mocked(getWebhookSample).mockResolvedValue(successDirectResponse)

      // When
      await webhookTriggerService(sampleFlags())

      // Then
      expectCalls(aVersion)
      expect(getWebhookSample).toHaveBeenCalledWith(aToken, aTopic, aVersion, 'localhost', aFullLocalAddress, aSecret)
      expect(triggerLocalWebhook).toHaveBeenCalledWith(aFullLocalAddress, samplePayload, sampleHeaders)
      expect(consoleError).toHaveBeenCalledWith('Localhost delivery failed')
    })
  })

  describe('Shared secret choices', () => {
    beforeEach(async () => {
      vi.mock('@shopify/cli-kit/node/ui')
      vi.mock('./find-app-info.js')

      vi.mocked(requestApiVersions).mockResolvedValue([aVersion])
      vi.mocked(collectApiVersion).mockResolvedValue(aVersion)
      vi.mocked(requestTopics).mockResolvedValue([aTopic])
      vi.mocked(collectTopic).mockResolvedValue(aTopic)
      vi.mocked(collectAddressAndMethod).mockResolvedValue(['localhost', aFullLocalAddress])

      vi.mocked(triggerLocalWebhook).mockResolvedValue(true)
      vi.mocked(getWebhookSample).mockResolvedValue(successDirectResponse)
    })

    it('manual', async () => {
      // Given
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(collectSecret).mockResolvedValue(aSecret)

      // When
      await webhookTriggerService(noSecretSampleFlags())

      // Then
      expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
      expect(collectSecret).toHaveBeenCalledOnce()
    })

    it('uses .env credentials', async () => {
      // Given
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
      vi.mocked(findInEnv).mockResolvedValue({clientSecret: aSecret})

      // When
      await webhookTriggerService(noSecretSampleFlags())

      // Then
      expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
      expect(collectSecret).toHaveBeenCalledTimes(0)
      expect(requestAppInfo).toHaveBeenCalledTimes(0)
      expect(outputInfo).toHaveBeenCalledWith('Reading client-secret from .env file')
    })

    it('no remote apiKey found', async () => {
      // Given
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
      vi.mocked(findInEnv).mockResolvedValue({})
      vi.mocked(findApiKey).mockResolvedValue(undefined)

      // When
      await webhookTriggerService(noSecretSampleFlags())

      // Then
      expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
      expect(collectSecret).toHaveBeenCalledOnce()
      expect(requestAppInfo).toHaveBeenCalledTimes(0)
    })

    it('remote apiKey found', async () => {
      // Given
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
      vi.mocked(findInEnv).mockResolvedValue({})
      vi.mocked(findApiKey).mockResolvedValue('API_KEY')
      vi.mocked(requestAppInfo).mockResolvedValue({clientSecret: aSecret, apiKey: 'API_KEY', clientId: 'Id'})

      // When
      await webhookTriggerService(noSecretSampleFlags())

      // Then
      expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
      expect(collectSecret).toHaveBeenCalledTimes(0)
      expect(outputInfo).toHaveBeenCalledWith('Reading client-secret from app settings in Partners')
      expect(requestAppInfo).toHaveBeenCalledWith(aToken, 'API_KEY')
    })

    it('remote apiKey found', async () => {
      // Given
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
      vi.mocked(findInEnv).mockResolvedValue({})
      vi.mocked(findApiKey).mockResolvedValue('API_KEY')
      vi.mocked(requestAppInfo).mockResolvedValue({clientSecret: aSecret, apiKey: 'API_KEY', clientId: 'Id'})

      // When
      await webhookTriggerService(noSecretSampleFlags())

      // Then
      expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
      expect(collectSecret).toHaveBeenCalledTimes(0)
      expect(outputInfo).toHaveBeenCalledWith('Reading client-secret from app settings in Partners')
      expect(requestAppInfo).toHaveBeenCalledWith(aToken, 'API_KEY')
    })

    it('remote apiKey found but no app info', async () => {
      // Given
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
      vi.mocked(findInEnv).mockResolvedValue({})
      vi.mocked(findApiKey).mockResolvedValue('API_KEY')
      vi.mocked(requestAppInfo).mockResolvedValue({})

      // When
      await webhookTriggerService(noSecretSampleFlags())

      // Then
      expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
      expect(collectSecret).toHaveBeenCalledOnce()
      expect(requestAppInfo).toHaveBeenCalledWith(aToken, 'API_KEY')
    })
  })

  function mockParams(version: string, topic: string, method: string, address: string, secret: string) {
    vi.mocked(requestApiVersions).mockResolvedValue([version])
    vi.mocked(collectApiVersion).mockResolvedValue(version)
    vi.mocked(requestTopics).mockResolvedValue([topic])
    vi.mocked(collectTopic).mockResolvedValue(topic)
    vi.mocked(collectAddressAndMethod).mockResolvedValue([method, address])
    vi.mocked(collectSecret).mockResolvedValue(secret)
  }

  function expectCalls(version: string) {
    expect(requestApiVersions).toHaveBeenCalledWith(aToken)
    expect(requestTopics).toHaveBeenCalledWith(aToken, version)
  }

  function sampleFlags(): WebhookTriggerFlags {
    const flags: WebhookTriggerFlags = {
      topic: aTopic,
      apiVersion: aVersion,
      deliveryMethod: 'event-bridge',
      clientSecret: aSecret,
      address: '',
    }

    return flags
  }

  function noSecretSampleFlags(): WebhookTriggerFlags {
    const flags: WebhookTriggerFlags = {
      topic: aTopic,
      apiVersion: aVersion,
      deliveryMethod: 'localhost',
      address: aFullLocalAddress,
    }

    return flags
  }
})
