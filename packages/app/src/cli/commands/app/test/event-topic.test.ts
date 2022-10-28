import TopicTesting from './event-topic.js'
import {
  requestSample,
  sendLocal,
  collectCliOptions,
  TestWebhookOptions,
  TestWebhookFlags,
} from '../../../services/app/test/event-topic.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {output} from '@shopify/cli-kit'

const samplePayload = '{ "sampleField": "SampleValue" }'
const sampleHeaders = '{ "header": "Header Value" }'
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
const aTopic = 'A_TOPIC'
const aVersion = 'A_VERSION'
const aSecret = 'A_SECRET'
const aPort = '1234'
const aUrlPath = '/a/url/path'
const anAddress = 'http://example.org'
const aFullLocalAddress = `http://localhost:${aPort}${aUrlPath}`
const env = process.env

beforeEach(async () => {
  vi.mock('@shopify/cli-kit')
  vi.mock('../../../prompts/test/event-topic.js')
  vi.mock('../../../services/app/test/event-topic.js')

  process.env = {
    ...env,
    SHOPIFY_FLAG_SHARED_SECRET: undefined,
  }
})

afterEach(async () => {
  vi.clearAllMocks()
  process.env = env
})

describe('run', () => {
  describe('without flags', () => {
    it('notifies about request errors', async () => {
      // Given
      vi.mocked(collectCliOptions).mockResolvedValue(sampleConsoleOptions())

      const response = {
        samplePayload: emptyJson,
        headers: emptyJson,
        success: false,
        userErrors: [
          {message: 'Error 1', fields: ['field1']},
          {message: 'Error 2', fields: ['field1']},
        ],
      }
      vi.mocked(requestSample).mockResolvedValue(response)

      const outputSpy = vi.spyOn(output, 'consoleError')

      // When
      await TopicTesting.run()

      // Then
      expect(outputSpy).toHaveBeenCalledWith(JSON.stringify(response.userErrors))
    })

    it('notifies about real delivery being sent', async () => {
      // Given
      vi.mocked(collectCliOptions).mockResolvedValue(sampleRemoteOptions())
      vi.mocked(sendLocal)
      vi.mocked(requestSample).mockResolvedValue(successEmptyResponse)

      const outputSpy = vi.spyOn(output, 'success')

      // When
      await TopicTesting.run()

      // Then
      expect(requestSample).toHaveBeenCalledWith(aTopic, aVersion, 'http', anAddress, aSecret)
      expect(sendLocal).toHaveBeenCalledTimes(0)
      expect(outputSpy).toHaveBeenCalledWith('Webhook will be delivered shortly')
    })

    describe('Localhost delivery', () => {
      it('delivers to localhost', async () => {
        // Given
        vi.mocked(collectCliOptions).mockResolvedValue(sampleLocalhostOptions())
        vi.mocked(requestSample).mockResolvedValue(successDirectResponse)
        vi.mocked(sendLocal).mockResolvedValue(true)

        const outputSpy = vi.spyOn(output, 'success')

        // When
        await TopicTesting.run()

        // Then
        expect(requestSample).toHaveBeenCalledWith(aTopic, aVersion, 'localhost', aFullLocalAddress, aSecret)
        expect(sendLocal).toHaveBeenCalledWith(aFullLocalAddress, samplePayload, sampleHeaders)
        expect(outputSpy).toHaveBeenCalledWith('Localhost delivery sucessful')
      })

      it('shows an error if localhost is not ready', async () => {
        // Given
        vi.mocked(collectCliOptions).mockResolvedValue(sampleLocalhostOptions())
        vi.mocked(requestSample).mockResolvedValue(successDirectResponse)
        vi.mocked(sendLocal).mockResolvedValue(false)

        const outputSpy = vi.spyOn(output, 'consoleError')

        // When
        await TopicTesting.run()

        // Then
        expect(requestSample).toHaveBeenCalledWith(aTopic, aVersion, 'localhost', aFullLocalAddress, aSecret)
        expect(sendLocal).toHaveBeenCalledWith(aFullLocalAddress, samplePayload, sampleHeaders)
        expect(outputSpy).toHaveBeenCalledWith('Localhost delivery failed')
      })
    })
  })

  describe('with flags', () => {
    beforeEach(async () => {
      process.env = {
        ...env,
        SHOPIFY_FLAG_SHARED_SECRET: 'A_SECRET',
      }
    })

    it('uses localhost delivery method params', async () => {
      // Given
      vi.mocked(collectCliOptions).mockResolvedValue(sampleLocalhostOptions())
      vi.mocked(requestSample).mockResolvedValue(successDirectResponse)
      vi.mocked(sendLocal).mockResolvedValue(false)

      // When
      await TopicTesting.run([
        '--topic',
        aTopic,
        '--api-version',
        aVersion,
        '--delivery-method',
        'http',
        '--address',
        'http://localhost:3030/some/path',
        '--port',
        aPort,
        '--url-path',
        aUrlPath,
      ])

      // Then
      const expectedParams: TestWebhookFlags = {
        topic: aTopic,
        apiVersion: aVersion,
        deliveryMethod: 'http',
        address: 'http://localhost:3030/some/path',
        port: aPort,
        urlPath: aUrlPath,
      }
      expect(collectCliOptions).toHaveBeenCalledWith(expectedParams)
      expect(sendLocal).toHaveBeenCalledWith(aFullLocalAddress, samplePayload, sampleHeaders)
    })

    it('uses remote delivery methods params', async () => {
      // Given
      vi.mocked(collectCliOptions).mockResolvedValue(sampleRemoteOptions())
      vi.mocked(requestSample).mockResolvedValue(successDirectResponse)
      vi.mocked(sendLocal)

      // When
      await TopicTesting.run([
        '--topic',
        aTopic,
        '--api-version',
        aVersion,
        '--delivery-method',
        'http',
        '--address',
        anAddress,
      ])

      // Then
      const expectedParams: TestWebhookFlags = {
        topic: aTopic,
        apiVersion: aVersion,
        deliveryMethod: 'http',
        address: anAddress,
      }
      expect(collectCliOptions).toHaveBeenCalledWith(expectedParams)
      expect(sendLocal).toHaveBeenCalledTimes(0)
    })
  })

  function sampleConsoleOptions(): TestWebhookOptions {
    const options: TestWebhookOptions = {
      topic: aTopic,
      apiVersion: aVersion,
      deliveryMethod: 'event-bridge',
      sharedSecret: aSecret,
      localhostPort: '',
      localhostUrlPath: '',
      address: '',
    }

    return options
  }

  function sampleLocalhostOptions(): TestWebhookOptions {
    const options: TestWebhookOptions = {
      topic: aTopic,
      apiVersion: aVersion,
      deliveryMethod: 'localhost',
      sharedSecret: aSecret,
      localhostPort: aPort,
      localhostUrlPath: aUrlPath,
      address: aFullLocalAddress,
    }

    return options
  }

  function sampleRemoteOptions(): TestWebhookOptions {
    const options: TestWebhookOptions = {
      topic: aTopic,
      apiVersion: aVersion,
      deliveryMethod: 'http',
      sharedSecret: aSecret,
      localhostPort: aPort,
      localhostUrlPath: aUrlPath,
      address: anAddress,
    }

    return options
  }
})
