import {collectAddressAndMethod, collectApiVersion, collectCredentials, collectTopic} from './trigger-options.js'
import {requestApiVersions} from './request-api-versions.js'
import {requestTopics} from './request-topics.js'
import {addressPrompt, apiVersionPrompt, deliveryMethodPrompt, topicPrompt} from '../../prompts/webhook/trigger.js'
import {testApp, testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {fetchAppFromConfigOrSelect} from '../app/fetch-app-from-config-or-select.js'
import {describe, expect, vi, test} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('../../prompts/webhook/trigger.js')
vi.mock('./request-api-versions.js')
vi.mock('./request-topics.js')
vi.mock('./find-app-info.js')
vi.mock('../app/fetch-app-from-config-or-select.js')

const DELIVERY_METHOD = 'http'
const SECRET = 'A_SECRET'
const API_KEY = 'AN_API_KEY'
const APP = testApp()
const ORGANIZATION_APP = testOrganizationApp()
const developerPlatformClient = testDeveloperPlatformClient()

describe('collectApiVersion', () => {
  test('uses the passed api-version', async () => {
    // Given
    vi.mocked(requestApiVersions).mockResolvedValue(['2023-01', 'unstable'])
    vi.mocked(apiVersionPrompt)

    // When
    const version = await collectApiVersion(developerPlatformClient, '2023-01')

    // Then
    expect(version).toEqual('2023-01')
    expect(apiVersionPrompt).toHaveBeenCalledTimes(0)
  })

  test('asks for api-version if not set', async () => {
    // Given
    vi.mocked(apiVersionPrompt).mockResolvedValue('2023-01')
    vi.mocked(requestApiVersions).mockResolvedValue(['2023-01', 'unstable'])

    // When
    const version = await collectApiVersion(developerPlatformClient, undefined)

    // Then
    expect(version).toEqual('2023-01')
    expect(apiVersionPrompt).toHaveBeenCalledOnce()
    expect(requestApiVersions).toHaveBeenCalledOnce()
  })
})

describe('collectTopic', () => {
  test('uses the passed topic if present for the api-version', async () => {
    // Given
    vi.mocked(topicPrompt)
    vi.mocked(requestTopics).mockResolvedValue(['shop/redact', 'orders/create'])

    // When
    const method = await collectTopic(developerPlatformClient, '2023-01', 'shop/redact')

    // Then
    expect(method).toEqual('shop/redact')
    expect(topicPrompt).toHaveBeenCalledTimes(0)
  })

  test('fails if the passed topic is not present in the api-version topics list', async () => {
    // Given
    vi.mocked(topicPrompt)
    vi.mocked(requestTopics).mockResolvedValue(['shop/redact', 'orders/create'])

    // When then
    await expect(collectTopic(developerPlatformClient, '2023-01', 'unknown/topic')).rejects.toThrow(AbortError)
    expect(topicPrompt).toHaveBeenCalledTimes(0)
  })

  test('asks for topic if not set', async () => {
    // Given
    vi.mocked(topicPrompt).mockResolvedValue('orders/create')
    vi.mocked(requestTopics).mockResolvedValue(['shop/redact', 'orders/create'])

    // When
    const topic = await collectTopic(developerPlatformClient, 'unstable', undefined)

    // Then
    expect(topic).toEqual('orders/create')
    expect(topicPrompt).toHaveBeenCalledOnce()
    expect(requestTopics).toHaveBeenCalledOnce()
  })
})

describe('collectAddressAndMethod', () => {
  test('uses the passed address - method pair', async () => {
    // Given
    vi.mocked(deliveryMethodPrompt)
    vi.mocked(addressPrompt)

    // When
    const [address, method] = await collectAddressAndMethod('http', 'http://localhost')

    // Then
    expect(method).toEqual('localhost')
    expect(address).toEqual('http://localhost')
    expect(deliveryMethodPrompt).toHaveBeenCalledTimes(0)
    expect(addressPrompt).toHaveBeenCalledTimes(0)
  })

  test('prompts for the address when deliveryMethod is passed', async () => {
    // Given
    vi.mocked(deliveryMethodPrompt)
    vi.mocked(addressPrompt).mockResolvedValue('http://localhost')

    // When
    const [address, method] = await collectAddressAndMethod('http', undefined)

    // Then
    expect(method).toEqual('localhost')
    expect(address).toEqual('http://localhost')
    expect(deliveryMethodPrompt).toHaveBeenCalledTimes(0)
    expect(addressPrompt).toHaveBeenCalledOnce()
  })

  test('prompts for the address and deliveryMethod when none passed', async () => {
    // Given
    vi.mocked(deliveryMethodPrompt).mockResolvedValue('http')
    vi.mocked(addressPrompt).mockResolvedValue('https://example.org')

    // When
    const [address, method] = await collectAddressAndMethod(undefined, undefined)

    // Then
    expect(method).toEqual('http')
    expect(address).toEqual('https://example.org')
    expect(deliveryMethodPrompt).toHaveBeenCalledOnce()
    expect(addressPrompt).toHaveBeenCalledOnce()
  })
})

describe('collectCredentials', () => {
  test('uses the value set as flag', async () => {
    // Given / When
    const credentials = await collectCredentials(API_KEY, SECRET, APP, DELIVERY_METHOD)

    // Then
    expect(credentials).toEqual({clientId: API_KEY, clientSecret: SECRET})
    expect(fetchAppFromConfigOrSelect).toHaveBeenCalledTimes(0)
  })

  test('retrieves the secret from config or remotely when the flag is missing', async () => {
    // Given
    vi.mocked(fetchAppFromConfigOrSelect).mockResolvedValue(ORGANIZATION_APP)

    // When
    const credentials = await collectCredentials(API_KEY, undefined, APP, DELIVERY_METHOD)

    // Then
    expect(credentials).toEqual({
      apiKey: ORGANIZATION_APP.apiKey,
      clientId: ORGANIZATION_APP.id,
      clientSecret: ORGANIZATION_APP.apiSecretKeys[0]!.secret,
      developerPlatformClient: undefined,
    })
    expect(fetchAppFromConfigOrSelect).toHaveBeenCalledOnce()
  })
})
