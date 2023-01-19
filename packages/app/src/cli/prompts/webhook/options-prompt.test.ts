import {optionsPrompt, WebhookTriggerFlags} from './options-prompt.js'
import {addressPrompt, apiVersionPrompt, deliveryMethodPrompt, sharedSecretPrompt, topicPrompt} from './trigger.js'
import {WebhookTriggerOptions} from '../../services/webhook/trigger-options.js'
import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'

beforeEach(() => {
  vi.mock('@shopify/cli-kit')
})

afterEach(async () => {
  vi.clearAllMocks()
})

const aTopic = 'A_TOPIC'
const aVersion = 'A_VERSION'
const unknownVersion = 'UNKNOWN_VERSION'
const aSecret = 'A_SECRET'
const aPort = '1234'
const aUrlPath = '/a/url/path'
const anAddress = 'https://example.org'
const aLocalAddress = `http://localhost:${aPort}${aUrlPath}`

describe('optionsPrompt', () => {
  beforeEach(async () => {
    vi.mock('./trigger.js')
    vi.mock('../../services/webhook/request-api-versions.js')
  })

  describe('without params', () => {
    beforeEach(async () => {
      vi.mocked(topicPrompt).mockResolvedValue(aTopic)
      vi.mocked(sharedSecretPrompt).mockResolvedValue(aSecret)
    })

    it('fails when unknown version passed', async () => {
      // Given
      vi.mocked(apiVersionPrompt).mockResolvedValue(unknownVersion)

      // Then when
      await expect(optionsPrompt({}, [aVersion])).rejects.toThrow(AbortError)
    })

    it('collects HTTP localhost params', async () => {
      // Given
      vi.mocked(apiVersionPrompt).mockResolvedValue(aVersion)
      vi.mocked(deliveryMethodPrompt).mockResolvedValue('http')
      vi.mocked(addressPrompt).mockResolvedValue(aLocalAddress)

      // When
      const options = await optionsPrompt({}, [aVersion])

      // Then
      const expected: WebhookTriggerOptions = {
        topic: aTopic,
        apiVersion: aVersion,
        sharedSecret: aSecret,
        deliveryMethod: 'localhost',
        address: aLocalAddress,
      }
      expect(options).toEqual(expected)
      expectBasicPromptsToHaveBeenCalledOnce()
      expect(addressPrompt).toHaveBeenCalledOnce()
    })

    it('collects HTTP remote delivery params', async () => {
      // Given
      vi.mocked(apiVersionPrompt).mockResolvedValue(aVersion)
      vi.mocked(deliveryMethodPrompt).mockResolvedValue('http')
      vi.mocked(addressPrompt).mockResolvedValue(anAddress)

      // When
      const options = await optionsPrompt({}, [aVersion])

      // Then
      const expected: WebhookTriggerOptions = {
        topic: aTopic,
        apiVersion: aVersion,
        sharedSecret: aSecret,
        deliveryMethod: 'http',
        address: anAddress,
      }
      expect(options).toEqual(expected)
      expectBasicPromptsToHaveBeenCalledOnce()
      expect(addressPrompt).toHaveBeenCalledOnce()
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
    })

    it('fails when unknown version', async () => {
      // Given
      const flags: WebhookTriggerFlags = {
        apiVersion: unknownVersion,
      }

      // Then when
      await expect(optionsPrompt(flags, [aVersion])).rejects.toThrow(AbortError)
    })

    describe('all params', () => {
      it('collects localhost delivery method required params', async () => {
        // Given
        const flags: WebhookTriggerFlags = {
          topic: aTopic,
          apiVersion: aVersion,
          sharedSecret: aSecret,
          deliveryMethod: 'http',
          address: aLocalAddress,
        }

        // When
        const options = await optionsPrompt(flags, [aVersion])

        // Then
        const expected: WebhookTriggerOptions = {
          topic: aTopic,
          apiVersion: aVersion,
          sharedSecret: aSecret,
          deliveryMethod: 'localhost',
          address: aLocalAddress,
        }
        expect(options).toEqual(expected)
        expectNoPrompts()
      })

      it('collects remote delivery method required params', async () => {
        // Given
        const flags: WebhookTriggerFlags = {
          topic: aTopic,
          apiVersion: aVersion,
          sharedSecret: aSecret,
          deliveryMethod: 'http',
          address: anAddress,
        }

        // When
        const options = await optionsPrompt(flags, [aVersion])

        // Then
        const expected: WebhookTriggerOptions = {
          topic: aTopic,
          apiVersion: aVersion,
          sharedSecret: aSecret,
          deliveryMethod: 'http',
          address: anAddress,
        }
        expect(options).toEqual(expected)
        expectNoPrompts()
      })

      it('fails when delivery method and address are not compatible', async () => {
        // Given
        const flags: WebhookTriggerFlags = {
          topic: aTopic,
          apiVersion: aVersion,
          sharedSecret: aSecret,
          deliveryMethod: 'google-pub-sub',
          address: anAddress,
        }

        // Then when
        await expect(optionsPrompt(flags, [aVersion])).rejects.toThrow(AbortError)
      })

      it('fails when delivery method is not valid', async () => {
        // Given
        const flags: WebhookTriggerFlags = {
          topic: aTopic,
          apiVersion: aVersion,
          sharedSecret: aSecret,
          deliveryMethod: 'WRONG_METHOD',
          address: anAddress,
        }

        // Then when
        await expect(optionsPrompt(flags, [aVersion])).rejects.toThrow(AbortError)
      })
    })

    describe('Address passed but not method', async () => {
      it('infers the method from the address', async () => {
        // Given
        const flags: WebhookTriggerFlags = {
          topic: aTopic,
          apiVersion: aVersion,
          sharedSecret: aSecret,
          address: aLocalAddress,
        }

        // When
        const options = await optionsPrompt(flags, [aVersion])

        // Then
        const expected: WebhookTriggerOptions = {
          topic: aTopic,
          apiVersion: aVersion,
          sharedSecret: aSecret,
          deliveryMethod: 'localhost',
          address: aLocalAddress,
        }
        expect(options).toEqual(expected)
        expectNoPrompts()
      })
    })

    describe('Method passed but not address', async () => {
      it('prompts for the address', async () => {
        // Given
        const flags: WebhookTriggerFlags = {
          topic: aTopic,
          apiVersion: aVersion,
          sharedSecret: aSecret,
          deliveryMethod: 'http',
        }
        vi.mocked(addressPrompt).mockResolvedValue(aLocalAddress)

        // When
        const options = await optionsPrompt(flags, [aVersion])

        // Then
        const expected: WebhookTriggerOptions = {
          topic: aTopic,
          apiVersion: aVersion,
          sharedSecret: aSecret,
          deliveryMethod: 'localhost',
          address: aLocalAddress,
        }
        expect(options).toEqual(expected)
        expect(addressPrompt).toHaveBeenCalledOnce()
      })
    })

    function expectNoPrompts() {
      expect(topicPrompt).toHaveBeenCalledTimes(0)
      expect(apiVersionPrompt).toHaveBeenCalledTimes(0)
      expect(sharedSecretPrompt).toHaveBeenCalledTimes(0)
      expect(deliveryMethodPrompt).toHaveBeenCalledTimes(0)
      expect(addressPrompt).toHaveBeenCalledTimes(0)
    }
  })
})
