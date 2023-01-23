import {collectAddressAndMethod, collectApiVersion, collectSecret, collectTopic} from './options-prompt.js'
import {addressPrompt, apiVersionPrompt, deliveryMethodPrompt, sharedSecretPrompt, topicPrompt} from './trigger.js'
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
const unknownTopic = 'UNKNOWN_TOPIC'
const aSecret = 'A_SECRET'
const aPort = '1234'
const aUrlPath = '/a/url/path'
const anAddress = 'https://example.org'
const aLocalAddress = `http://localhost:${aPort}${aUrlPath}`

describe('optionsPrompt', () => {
  beforeEach(async () => {
    vi.mock('./trigger.js')
  })

  describe('without params', () => {
    beforeEach(async () => {
      vi.mocked(topicPrompt).mockResolvedValue(aTopic)
      vi.mocked(sharedSecretPrompt).mockResolvedValue(aSecret)
    })

    it('collects HTTP localhost params', async () => {
      // Given
      vi.mocked(deliveryMethodPrompt).mockResolvedValue('http')
      vi.mocked(addressPrompt).mockResolvedValue(aLocalAddress)

      // When
      const [method, address] = await collectAddressAndMethod(undefined, undefined)

      // Then
      expect(method).toEqual('localhost')
      expect(address).toEqual(aLocalAddress)
      expect(addressPrompt).toHaveBeenCalledOnce()
    })

    it('collects HTTP remote delivery params', async () => {
      // Given
      vi.mocked(deliveryMethodPrompt).mockResolvedValue('http')
      vi.mocked(addressPrompt).mockResolvedValue(anAddress)

      // When
      const [method, address] = await collectAddressAndMethod(undefined, undefined)

      // Then
      expect(method).toEqual('http')
      expect(address).toEqual(anAddress)
      expect(addressPrompt).toHaveBeenCalledOnce()
    })
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
      // When
      await expect(collectApiVersion(unknownVersion, [aVersion])).rejects.toThrow(AbortError)
    })

    it('fails when unknown topic', async () => {
      // When
      await expect(collectTopic(unknownTopic, aVersion, [aTopic])).rejects.toThrow(AbortError)
    })

    it('fails when no topics', async () => {
      // When
      await expect(collectTopic(aTopic, aVersion, [])).rejects.toThrow(AbortError)
    })

    describe('all params', () => {
      it('collects localhost delivery method required params', async () => {
        // When
        const version = await collectApiVersion(aVersion, [aVersion])
        const topic = await collectTopic(aTopic, aVersion, [aTopic])
        const secret = await collectSecret(aSecret)
        const [deliveryMethod, address] = await collectAddressAndMethod('http', aLocalAddress)

        // Then
        expect(version).toEqual(aVersion)
        expect(topic).toEqual(aTopic)
        expect(secret).toEqual(aSecret)
        expect(deliveryMethod).toEqual('localhost')
        expect(address).toEqual(aLocalAddress)
        expectNoPrompts()
      })

      it('collects remote delivery method required params', async () => {
        // When
        const [deliveryMethod, address] = await collectAddressAndMethod('http', anAddress)

        // Then
        expect(deliveryMethod).toEqual('http')
        expect(address).toEqual(anAddress)
        expectNoPrompts()
      })

      it('fails when delivery method and address are not compatible', async () => {
        // When
        await expect(collectAddressAndMethod('google-pub-sub', anAddress)).rejects.toThrow(AbortError)
      })

      it('fails when delivery method is not valid', async () => {
        // When
        await expect(collectAddressAndMethod('WRONG_METHOD', anAddress)).rejects.toThrow(AbortError)
      })
    })

    describe('Address passed but not method', async () => {
      it('infers the method from the address', async () => {
        // When
        const [deliveryMethod, address] = await collectAddressAndMethod(undefined, aLocalAddress)

        // Then
        expect(deliveryMethod).toEqual('localhost')
        expect(address).toEqual(aLocalAddress)
        expectNoPrompts()
      })
    })

    describe('Method passed but not address', async () => {
      it('prompts for the address', async () => {
        // Given
        vi.mocked(addressPrompt).mockResolvedValue(aLocalAddress)

        // When
        const [deliveryMethod, address] = await collectAddressAndMethod('http', undefined)

        // Then
        expect(deliveryMethod).toEqual('localhost')
        expect(address).toEqual(aLocalAddress)
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
