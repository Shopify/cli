import {webhookTriggerService} from './trigger.js'
import {SendSampleWebhookVariables, getWebhookSample} from './request-sample.js'
import {requestApiVersions} from './request-api-versions.js'
import {requestTopics} from './request-topics.js'
import {WebhookTriggerFlags} from './trigger-flags.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {findOrganizationApp, findInEnv} from './find-app-info.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {outputSuccess, consoleError, outputInfo} from '@shopify/cli-kit/node/output'
import {describe, expect, vi, test} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'

const samplePayload = '{ "sampleField": "SampleValue" }'
const sampleHeaders = '{ "header": "Header Value" }'
const aTopic = 'A_TOPIC'
const aVersion = 'A_VERSION'
const aSecret = 'A_SECRET'
const anApiKey = 'AN_API_KEY'
const aPort = '1234'
const aUrlPath = '/a/url/path'
const anAddress = 'https://example.org'
const anEventBridgeAddress = 'arn:aws:events:us-east-3::event-source/aws.partner/shopify.com/12/source'

vi.mock('@shopify/cli-kit')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../prompts/webhook/options-prompt.js')
vi.mock('./request-sample.js')
vi.mock('./request-api-versions.js')
vi.mock('./request-topics.js')
vi.mock('./trigger-local-webhook.js')
vi.mock('./find-app-info.js')

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
const developerPlatformClient = testDeveloperPlatformClient()

describe('webhookTriggerService', () => {
  test('notifies about request errors', async () => {
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
    mockLists(aVersion, aTopic)
    vi.mocked(getWebhookSample).mockResolvedValue(response)

    // When
    await webhookTriggerService(sampleFlags())

    // Then
    expectCalls(aVersion)
    expect(consoleError).toHaveBeenCalledWith(`Request errors:\n  · Some error\n  · Another error`)
  })

  test('Safe notification in case of unexpected request errors', async () => {
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
    mockLists(aVersion, aTopic)

    vi.mocked(getWebhookSample).mockResolvedValue(response)

    // When
    await webhookTriggerService(sampleFlags())

    // Then
    expectCalls(aVersion)
    expect(consoleError).toHaveBeenCalledWith(`Request errors:\n${JSON.stringify(response.userErrors)}`)
  })

  test('notifies about real delivery being sent', async () => {
    // Given
    mockLists(aVersion, aTopic)
    vi.mocked(triggerLocalWebhook)
    vi.mocked(getWebhookSample).mockResolvedValue(successEmptyResponse)
    const expectedSampleWebhookVariables: SendSampleWebhookVariables = {
      topic: aTopic,
      delivery_method: 'http',
      address: anAddress,
      shared_secret: aSecret,
      api_version: aVersion,
    }

    // When
    await webhookTriggerService(sampleFlags())

    // Then
    expectCalls(aVersion)
    expect(getWebhookSample).toHaveBeenCalledWith(developerPlatformClient, expectedSampleWebhookVariables)
    expect(triggerLocalWebhook).toHaveBeenCalledTimes(0)
    expect(outputSuccess).toHaveBeenCalledWith('Webhook has been enqueued for delivery')
  })

  test("won't send to event-bridge if api-key not found", async () => {
    // Given
    mockLists(aVersion, aTopic)
    vi.mocked(findInEnv).mockResolvedValue({})
    vi.mocked(findOrganizationApp).mockResolvedValue({organizationId: '1'})

    // When
    await expect(webhookTriggerService(eventBridgeFlags())).rejects.toThrow(AbortError)
  })

  test('notifies about real event-bridge delivery being sent', async () => {
    // Given
    mockLists(aVersion, aTopic)
    vi.mocked(findInEnv).mockResolvedValue({})
    vi.mocked(findOrganizationApp).mockResolvedValue({organizationId: '1', id: anApiKey, apiKey: anApiKey})
    vi.mocked(getWebhookSample).mockResolvedValue(successEmptyResponse)
    const expectedSampleWebhookVariables: SendSampleWebhookVariables = {
      topic: aTopic,
      delivery_method: 'event-bridge',
      address: anEventBridgeAddress,
      shared_secret: aSecret,
      api_version: aVersion,
      api_key: anApiKey,
    }

    // When
    await webhookTriggerService(eventBridgeFlags())

    // Then
    expectCalls(aVersion)
    expect(getWebhookSample).toHaveBeenCalledWith(developerPlatformClient, expectedSampleWebhookVariables)
    expect(outputSuccess).toHaveBeenCalledWith('Webhook has been enqueued for delivery')
    expect(outputInfo).toHaveBeenCalledWith('Using api-key from app settings in Partners')
  })

  describe('Localhost delivery', () => {
    test('delivers to localhost', async () => {
      // Given
      mockLists(aVersion, aTopic)
      vi.mocked(triggerLocalWebhook).mockResolvedValue(true)
      vi.mocked(getWebhookSample).mockResolvedValue(successDirectResponse)
      const expectedSampleWebhookVariables: SendSampleWebhookVariables = {
        topic: aTopic,
        delivery_method: 'localhost',
        address: aFullLocalAddress,
        shared_secret: aSecret,
        api_version: aVersion,
      }

      // When
      await webhookTriggerService(sampleLocalhostFlags())

      // Then
      expectCalls(aVersion)
      expect(getWebhookSample).toHaveBeenCalledWith(developerPlatformClient, expectedSampleWebhookVariables)
      expect(triggerLocalWebhook).toHaveBeenCalledWith(aFullLocalAddress, samplePayload, sampleHeaders)
      expect(outputSuccess).toHaveBeenCalledWith('Localhost delivery sucessful')
    })

    test('shows an error if localhost is not ready', async () => {
      // Given
      mockLists(aVersion, aTopic)
      vi.mocked(triggerLocalWebhook).mockResolvedValue(false)
      vi.mocked(getWebhookSample).mockResolvedValue(successDirectResponse)
      const expectedSampleWebhookVariables: SendSampleWebhookVariables = {
        topic: aTopic,
        delivery_method: 'localhost',
        address: aFullLocalAddress,
        shared_secret: aSecret,
        api_version: aVersion,
      }

      // When
      await webhookTriggerService(sampleLocalhostFlags())

      // Then
      expectCalls(aVersion)
      expect(getWebhookSample).toHaveBeenCalledWith(developerPlatformClient, expectedSampleWebhookVariables)
      expect(triggerLocalWebhook).toHaveBeenCalledWith(aFullLocalAddress, samplePayload, sampleHeaders)
      expect(consoleError).toHaveBeenCalledWith('Localhost delivery failed')
    })
  })

  function mockLists(version: string, topic: string) {
    vi.mocked(requestApiVersions).mockResolvedValue([version])
    vi.mocked(requestTopics).mockResolvedValue([topic])
  }

  function expectCalls(version: string) {
    expect(requestApiVersions).toHaveBeenCalledWith(developerPlatformClient)
    expect(requestTopics).toHaveBeenCalledWith(developerPlatformClient, version)
  }

  function sampleFlags(): WebhookTriggerFlags {
    const flags: WebhookTriggerFlags = {
      topic: aTopic,
      apiVersion: aVersion,
      deliveryMethod: 'http',
      clientSecret: aSecret,
      address: anAddress,
      developerPlatformClient,
    }

    return flags
  }

  function eventBridgeFlags(): WebhookTriggerFlags {
    const flags: WebhookTriggerFlags = {
      topic: aTopic,
      apiVersion: aVersion,
      deliveryMethod: 'event-bridge',
      clientSecret: aSecret,
      address: anEventBridgeAddress,
      developerPlatformClient,
    }

    return flags
  }

  function sampleLocalhostFlags(): WebhookTriggerFlags {
    const flags: WebhookTriggerFlags = {
      topic: aTopic,
      apiVersion: aVersion,
      deliveryMethod: 'http',
      clientSecret: aSecret,
      address: aFullLocalAddress,
      developerPlatformClient,
    }

    return flags
  }
})
