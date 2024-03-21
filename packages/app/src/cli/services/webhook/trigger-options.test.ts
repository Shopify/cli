import {
  collectAddressAndMethod,
  collectApiKey,
  collectApiVersion,
  collectCredentials,
  collectTopic,
} from './trigger-options.js'
import {requestApiVersions} from './request-api-versions.js'
import {requestTopics} from './request-topics.js'
import {findOrganizationApp, findInEnv, requestAppInfo} from './find-app-info.js'
import {
  addressPrompt,
  apiVersionPrompt,
  clientSecretPrompt,
  deliveryMethodPrompt,
  topicPrompt,
} from '../../prompts/webhook/trigger.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, vi, test} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('../../prompts/webhook/trigger.js')
vi.mock('./request-api-versions.js')
vi.mock('./request-topics.js')
vi.mock('./find-app-info.js')

const aSecret = 'A_SECRET'
const anApiKey = 'AN_API_KEY'
const developerPlatformClient = testDeveloperPlatformClient()

describe('collectApiVersion', () => {
  test('uses the passed api-version', async () => {
    // Given
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
    const [method, address] = await collectAddressAndMethod('http', 'http://localhost')

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
    const [method, address] = await collectAddressAndMethod('http', undefined)

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
    const [method, address] = await collectAddressAndMethod(undefined, undefined)

    // Then
    expect(method).toEqual('http')
    expect(address).toEqual('https://example.org')
    expect(deliveryMethodPrompt).toHaveBeenCalledOnce()
    expect(addressPrompt).toHaveBeenCalledOnce()
  })
})

describe('collectCredentials', () => {
  test('uses the value set as flag', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt)
    vi.mocked(clientSecretPrompt)
    vi.mocked(findInEnv)
    vi.mocked(findOrganizationApp)
    vi.mocked(requestAppInfo)

    // When
    const credentials = await collectCredentials(developerPlatformClient, aSecret)

    // Then
    expect(credentials).toEqual({clientSecret: aSecret})
    expect(renderConfirmationPrompt).toHaveBeenCalledTimes(0)
    expect(clientSecretPrompt).toHaveBeenCalledTimes(0)
    expect(findInEnv).toHaveBeenCalledTimes(0)
    expect(findOrganizationApp).toHaveBeenCalledTimes(0)
    expect(requestAppInfo).toHaveBeenCalledTimes(0)
  })

  test('prompts for secret if manual', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    vi.mocked(clientSecretPrompt).mockResolvedValue(aSecret)
    vi.mocked(findInEnv)
    vi.mocked(findOrganizationApp)
    vi.mocked(requestAppInfo)

    // When
    const credentials = await collectCredentials(developerPlatformClient, undefined)

    // Then
    expect(credentials).toEqual({clientSecret: aSecret})
    expect(clientSecretPrompt).toHaveBeenCalledOnce()
    expect(findInEnv).toHaveBeenCalledTimes(0)
    expect(findOrganizationApp).toHaveBeenCalledTimes(0)
    expect(requestAppInfo).toHaveBeenCalledTimes(0)
  })

  test('uses .env credentials when present and automatic', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(clientSecretPrompt)
    vi.mocked(findInEnv).mockResolvedValue({clientSecret: aSecret, apiKey: anApiKey})
    vi.mocked(findOrganizationApp)
    vi.mocked(requestAppInfo)

    // When
    const secret = await collectCredentials(developerPlatformClient, undefined)

    // Then
    expect(secret).toEqual({clientSecret: aSecret, apiKey: anApiKey})
    expect(clientSecretPrompt).toHaveBeenCalledTimes(0)
    expect(findInEnv).toHaveBeenCalledOnce()
    expect(findOrganizationApp).toHaveBeenCalledTimes(0)
    expect(requestAppInfo).toHaveBeenCalledTimes(0)
    expect(outputInfo).toHaveBeenCalledWith('Reading client-secret from .env file')
  })

  test('prompts when no .env and no remote api-key found and automatic', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(clientSecretPrompt).mockResolvedValue(aSecret)
    vi.mocked(findInEnv).mockResolvedValue({})
    vi.mocked(findOrganizationApp).mockResolvedValue({organizationId: '1'})
    vi.mocked(requestAppInfo)

    // When
    const secret = await collectCredentials(developerPlatformClient, undefined)

    // Then
    expect(secret).toEqual({clientSecret: aSecret})
    expect(clientSecretPrompt).toHaveBeenCalledOnce()
    expect(findInEnv).toHaveBeenCalledOnce()
    expect(findOrganizationApp).toHaveBeenCalledOnce()
    expect(requestAppInfo).toHaveBeenCalledTimes(0)
  })

  test('uses remote secret when no .env and automatic', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(clientSecretPrompt)
    vi.mocked(findInEnv).mockResolvedValue({})
    vi.mocked(findOrganizationApp).mockResolvedValue({organizationId: '1', apiKey: anApiKey, id: anApiKey})
    vi.mocked(requestAppInfo).mockResolvedValue({clientSecret: aSecret, apiKey: anApiKey, clientId: 'Id'})

    // When
    const secret = await collectCredentials(developerPlatformClient, undefined)

    // Then
    expect(secret).toEqual({clientSecret: aSecret, apiKey: anApiKey, clientId: 'Id'})
    expect(clientSecretPrompt).toHaveBeenCalledTimes(0)
    expect(findInEnv).toHaveBeenCalledOnce()
    expect(findOrganizationApp).toHaveBeenCalledOnce()
    expect(requestAppInfo).toHaveBeenCalledWith(
      {id: anApiKey, apiKey: anApiKey, organizationId: '1'},
      developerPlatformClient,
    )
    expect(outputInfo).toHaveBeenCalledWith('Reading client-secret from app settings in Partners')
  })

  test('prompts for secret when no .env, and no app, and automatic', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(clientSecretPrompt).mockResolvedValue(aSecret)
    vi.mocked(findInEnv).mockResolvedValue({})
    vi.mocked(findOrganizationApp).mockResolvedValue({organizationId: '1', apiKey: anApiKey, id: anApiKey})
    vi.mocked(requestAppInfo).mockResolvedValue({})

    // When
    const secret = await collectCredentials(developerPlatformClient, undefined)

    // Then
    expect(secret).toEqual({clientSecret: aSecret, apiKey: anApiKey})
    expect(clientSecretPrompt).toHaveBeenCalledOnce()
    expect(findInEnv).toHaveBeenCalledOnce()
    expect(findOrganizationApp).toHaveBeenCalledOnce()
    expect(requestAppInfo).toHaveBeenCalledWith(
      {id: anApiKey, apiKey: anApiKey, organizationId: '1'},
      developerPlatformClient,
    )
  })
})

describe('collectApiKey', () => {
  test('uses .env value when present', async () => {
    // Given
    vi.mocked(findInEnv).mockResolvedValue({clientSecret: aSecret, apiKey: anApiKey})
    vi.mocked(findOrganizationApp)

    // When
    const apiKey = await collectApiKey(developerPlatformClient)

    // Then
    expect(apiKey).toEqual(anApiKey)
    expect(findInEnv).toHaveBeenCalledOnce()
    expect(findOrganizationApp).toHaveBeenCalledTimes(0)
    expect(outputInfo).toHaveBeenCalledWith('Using api-key from .env file')
  })

  test('uses remote value when no .env', async () => {
    // Given
    vi.mocked(findInEnv).mockResolvedValue({})
    vi.mocked(findOrganizationApp).mockResolvedValue({organizationId: '1', apiKey: anApiKey, id: anApiKey})

    // When
    const apiKey = await collectApiKey(developerPlatformClient)

    // Then
    expect(apiKey).toEqual(anApiKey)
    expect(findInEnv).toHaveBeenCalledOnce()
    expect(findOrganizationApp).toHaveBeenCalledOnce()
    expect(outputInfo).toHaveBeenCalledWith('Using api-key from app settings in Partners')
  })

  test('fails when no .env, and no app', async () => {
    // Given
    vi.mocked(findInEnv).mockResolvedValue({})
    vi.mocked(findOrganizationApp).mockResolvedValue({organizationId: '1'})

    // When Then
    await expect(collectApiKey(developerPlatformClient)).rejects.toThrow(AbortError)
  })
})
