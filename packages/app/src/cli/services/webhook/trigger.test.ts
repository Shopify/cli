import {webhookTriggerService} from './trigger.js'
import {getWebhookSample} from './request-sample.js'
import {requestApiVersions} from './request-api-versions.js'
import {requestTopics} from './request-topics.js'
import {WebhookTriggerFlags} from './trigger-flags.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {findApiKey, findInEnv} from './find-app-info.js'
import {fetchPartnersSession} from '../context/partner-account-info.js'
import {testPartnersUserSession} from '../../models/app/app.test-data.js'
import {outputSuccess, consoleError, outputInfo} from '@shopify/cli-kit/node/output'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'

const aToken = 'token'
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
vi.mock('../context/partner-account-info.js')
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

describe('webhookTriggerService', () => {
  beforeEach(async () => {
    vi.mocked(fetchPartnersSession).mockResolvedValue(testPartnersUserSession)
  })

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

    // When
    await webhookTriggerService(sampleFlags())

    // Then
    expectCalls(aVersion)
    expect(getWebhookSample).toHaveBeenCalledWith(aToken, aTopic, aVersion, 'http', anAddress, aSecret)
    expect(triggerLocalWebhook).toHaveBeenCalledTimes(0)
    expect(outputSuccess).toHaveBeenCalledWith('Webhook has been enqueued for delivery')
  })

  test("won't send to event-bridge if api-key not found", async () => {
    // Given
    mockLists(aVersion, aTopic)
    vi.mocked(findInEnv).mockResolvedValue({})
    vi.mocked(findApiKey).mockResolvedValue(undefined)

    // When
    await expect(webhookTriggerService(eventBridgeFlags())).rejects.toThrow(AbortError)
  })

  test('notifies about real event-bridge delivery being sent', async () => {
    // Given
    mockLists(aVersion, aTopic)
    vi.mocked(findInEnv).mockResolvedValue({})
    vi.mocked(findApiKey).mockResolvedValue(anApiKey)
    vi.mocked(getWebhookSample).mockResolvedValue(successEmptyResponse)

    // When
    await webhookTriggerService(eventBridgeFlags())

    // Then
    expectCalls(aVersion)
    expect(getWebhookSample).toHaveBeenCalledWith(
      aToken,
      aTopic,
      aVersion,
      'event-bridge',
      anEventBridgeAddress,
      aSecret,
      anApiKey,
    )
    expect(outputSuccess).toHaveBeenCalledWith('Webhook has been enqueued for delivery')
    expect(outputInfo).toHaveBeenCalledWith('Using api-key from app settings in Partners')
  })

  describe('Localhost delivery', () => {
    test('delivers to localhost', async () => {
      // Given
      mockLists(aVersion, aTopic)

      vi.mocked(triggerLocalWebhook).mockResolvedValue(true)
      vi.mocked(getWebhookSample).mockResolvedValue(successDirectResponse)

      // When
      await webhookTriggerService(sampleLocalhostFlags())

      // Then
      expectCalls(aVersion)
      expect(getWebhookSample).toHaveBeenCalledWith(aToken, aTopic, aVersion, 'localhost', aFullLocalAddress, aSecret)
      expect(triggerLocalWebhook).toHaveBeenCalledWith(aFullLocalAddress, samplePayload, sampleHeaders)
      expect(outputSuccess).toHaveBeenCalledWith('Localhost delivery sucessful')
    })

    test('shows an error if localhost is not ready', async () => {
      // Given
      mockLists(aVersion, aTopic)

      vi.mocked(triggerLocalWebhook).mockResolvedValue(false)
      vi.mocked(getWebhookSample).mockResolvedValue(successDirectResponse)

      // When
      await webhookTriggerService(sampleLocalhostFlags())

      // Then
      expectCalls(aVersion)
      expect(getWebhookSample).toHaveBeenCalledWith(aToken, aTopic, aVersion, 'localhost', aFullLocalAddress, aSecret)
      expect(triggerLocalWebhook).toHaveBeenCalledWith(aFullLocalAddress, samplePayload, sampleHeaders)
      expect(consoleError).toHaveBeenCalledWith('Localhost delivery failed')
    })
  })

  function mockLists(version: string, topic: string) {
    vi.mocked(requestApiVersions).mockResolvedValue([version])
    vi.mocked(requestTopics).mockResolvedValue([topic])
  }

  function expectCalls(version: string) {
    expect(requestApiVersions).toHaveBeenCalledWith(aToken)
    expect(requestTopics).toHaveBeenCalledWith(aToken, version)
  }

  function sampleFlags(): WebhookTriggerFlags {
    const flags: WebhookTriggerFlags = {
      topic: aTopic,
      apiVersion: aVersion,
      deliveryMethod: 'http',
      clientSecret: aSecret,
      address: anAddress,
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
    }

    return flags
  }
})
