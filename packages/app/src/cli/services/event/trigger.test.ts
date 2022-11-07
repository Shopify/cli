import {eventTriggerService} from './trigger.js'
import {EventTriggerOptions} from './trigger-options.js'
import {getEventSample} from './request-sample.js'
import {triggerLocalEvent} from './trigger-local-event.js'
import {output} from '@shopify/cli-kit'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const samplePayload = '{ "sampleField": "SampleValue" }'
const sampleHeaders = '{ "header": "Header Value" }'
const aTopic = 'A_TOPIC'
const aVersion = 'A_VERSION'
const aSecret = 'A_SECRET'
const aPort = '1234'
const aUrlPath = '/a/url/path'
const anAddress = 'http://example.org'

beforeEach(async () => {
  vi.mock('@shopify/cli-kit')
  vi.mock('./request-sample.js')
  vi.mock('./trigger-local-event.js')
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

describe('execute', () => {
  it('notifies about request errors', async () => {
    // Given
    const response = {
      samplePayload: emptyJson,
      headers: emptyJson,
      success: false,
      userErrors: [
        {message: 'Error 1', fields: ['field1']},
        {message: 'Error 2', fields: ['field1']},
      ],
    }
    vi.mocked(getEventSample).mockResolvedValue(response)

    const outputSpy = vi.spyOn(output, 'consoleError')

    // When
    await eventTriggerService(sampleOptions())

    // Then
    expect(outputSpy).toHaveBeenCalledWith(JSON.stringify(response.userErrors))
  })

  it('notifies about real delivery being sent', async () => {
    // Given
    vi.mocked(triggerLocalEvent)
    vi.mocked(getEventSample).mockResolvedValue(successEmptyResponse)

    const outputSpy = vi.spyOn(output, 'success')

    // When
    await eventTriggerService(sampleRemoteOptions())

    // Then
    expect(getEventSample).toHaveBeenCalledWith(aTopic, aVersion, 'http', anAddress, aSecret)
    expect(triggerLocalEvent).toHaveBeenCalledTimes(0)
    expect(outputSpy).toHaveBeenCalledWith('Webhook will be delivered shortly')
  })

  describe('Localhost delivery', () => {
    it('delivers to localhost', async () => {
      // Given
      vi.mocked(getEventSample).mockResolvedValue(successDirectResponse)
      vi.mocked(triggerLocalEvent).mockResolvedValue(true)

      const outputSpy = vi.spyOn(output, 'success')

      // When
      await eventTriggerService(sampleLocalhostOptions())

      // Then
      expect(getEventSample).toHaveBeenCalledWith(aTopic, aVersion, 'localhost', aFullLocalAddress, aSecret)
      expect(triggerLocalEvent).toHaveBeenCalledWith(aFullLocalAddress, samplePayload, sampleHeaders)
      expect(outputSpy).toHaveBeenCalledWith('Localhost delivery sucessful')
    })

    it('shows an error if localhost is not ready', async () => {
      // Given
      vi.mocked(getEventSample).mockResolvedValue(successDirectResponse)
      vi.mocked(triggerLocalEvent).mockResolvedValue(false)

      const outputSpy = vi.spyOn(output, 'consoleError')

      // When
      await eventTriggerService(sampleLocalhostOptions())

      // Then
      expect(getEventSample).toHaveBeenCalledWith(aTopic, aVersion, 'localhost', aFullLocalAddress, aSecret)
      expect(triggerLocalEvent).toHaveBeenCalledWith(aFullLocalAddress, samplePayload, sampleHeaders)
      expect(outputSpy).toHaveBeenCalledWith('Localhost delivery failed')
    })
  })

  function sampleOptions(): EventTriggerOptions {
    const options: EventTriggerOptions = {
      topic: aTopic,
      apiVersion: aVersion,
      deliveryMethod: 'event-bridge',
      sharedSecret: aSecret,
      address: '',
    }

    return options
  }

  function sampleLocalhostOptions(): EventTriggerOptions {
    const options: EventTriggerOptions = {
      topic: aTopic,
      apiVersion: aVersion,
      deliveryMethod: 'localhost',
      sharedSecret: aSecret,
      address: aFullLocalAddress,
    }

    return options
  }

  function sampleRemoteOptions(): EventTriggerOptions {
    const options: EventTriggerOptions = {
      topic: aTopic,
      apiVersion: aVersion,
      deliveryMethod: 'http',
      sharedSecret: aSecret,
      address: anAddress,
    }

    return options
  }
})
