import {collectAddressAndMethod, collectApiVersion, collectCredentials, collectTopic} from './trigger-options.js'
import {requestApiVersions} from './request-api-versions.js'
import {requestTopics} from './request-topics.js'
import {WebhookTriggerInput} from './trigger.js'
import {addressPrompt, apiVersionPrompt, deliveryMethodPrompt, topicPrompt} from '../../prompts/webhook/trigger.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganizationApp,
  testOrganizationAppWithoutClientSecret,
} from '../../models/app/app.test-data.js'
import {describe, expect, vi, test, afterEach} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../prompts/webhook/trigger.js')
vi.mock('./request-api-versions.js')
vi.mock('./request-topics.js')

const DELIVERY_METHOD = 'http'
const SECRET = 'A_SECRET'
const API_KEY = 'AN_API_KEY'
const APP = testAppLinked()
const ORGANIZATION_APP = testOrganizationApp()
const developerPlatformClient = testDeveloperPlatformClient()
const organizationId = ORGANIZATION_APP.organizationId

afterEach(() => {
  mockAndCaptureOutput().clear()
  vi.unstubAllEnvs()
})

describe('collectApiVersion', () => {
  test('uses the passed api-version', async () => {
    // Given
    vi.mocked(requestApiVersions).mockResolvedValue(['2023-01', 'unstable'])
    vi.mocked(apiVersionPrompt)

    // When
    const version = await collectApiVersion(developerPlatformClient, '2023-01', organizationId)

    // Then
    expect(version).toEqual('2023-01')
    expect(apiVersionPrompt).toHaveBeenCalledTimes(0)
  })

  test('asks for api-version if not set', async () => {
    // Given
    vi.mocked(apiVersionPrompt).mockResolvedValue('2023-01')
    vi.mocked(requestApiVersions).mockResolvedValue(['2023-01', 'unstable'])

    // When
    const version = await collectApiVersion(developerPlatformClient, undefined, organizationId)

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
    const method = await collectTopic(
      developerPlatformClient,
      '2023-01',
      'shop/redact',
      ORGANIZATION_APP.organizationId,
    )

    // Then
    expect(method).toEqual('shop/redact')
    expect(topicPrompt).toHaveBeenCalledTimes(0)
  })

  test('fails if the passed topic is not present in the api-version topics list', async () => {
    // Given
    vi.mocked(topicPrompt)
    vi.mocked(requestTopics).mockResolvedValue(['shop/redact', 'orders/create'])

    // When then
    await expect(collectTopic(developerPlatformClient, '2023-01', 'unknown/topic', organizationId)).rejects.toThrow(
      AbortError,
    )
    expect(topicPrompt).toHaveBeenCalledTimes(0)
  })

  test('asks for topic if not set', async () => {
    // Given
    vi.mocked(topicPrompt).mockResolvedValue('orders/create')
    vi.mocked(requestTopics).mockResolvedValue(['shop/redact', 'orders/create'])

    // When
    const topic = await collectTopic(developerPlatformClient, 'unstable', undefined, organizationId)

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

  test('infers the deliveryMethod when only the address is passed', async () => {
    // Given / When
    const [address, method] = await collectAddressAndMethod(undefined, 'https://example.org')

    // Then
    expect(method).toEqual('http')
    expect(address).toEqual('https://example.org')
  })
})

describe('collectCredentials', () => {
  const input: Pick<WebhookTriggerInput, 'clientSecret' | 'clientId' | 'remoteApp' | 'app'> = {
    clientSecret: SECRET,
    clientId: API_KEY,
    remoteApp: ORGANIZATION_APP,
    app: APP,
  }
  test('uses the value set as flag', async () => {
    // Given / When
    const credentials = await collectCredentials(input, DELIVERY_METHOD)

    // Then
    expect(credentials).toEqual({apiKey: API_KEY, clientSecret: SECRET})
  })

  test('fetches the secret from the Developer Dashboard when the flag is missing', async () => {
    // Given
    const remoteApp = testOrganizationApp()
    const inputWithoutSecret = {...input, clientSecret: undefined, remoteApp}

    // When
    const credentials = await collectCredentials(inputWithoutSecret, DELIVERY_METHOD)

    // Then
    expect(credentials).toEqual({apiKey: remoteApp.apiKey, clientSecret: 'api-secret'})
  })

  test('uses the secret flag with the app API key for EventBridge without a client ID', async () => {
    // Given
    vi.stubEnv('SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'automation-token')
    const appClientSecrets = vi.fn()
    const remoteApp = testOrganizationApp({
      apiSecretKeys: [],
      developerPlatformClient: testDeveloperPlatformClient({appClientSecrets}),
    })
    const eventBridgeInput = {...input, clientId: undefined, remoteApp}

    // When
    const credentials = await collectCredentials(eventBridgeInput, 'event-bridge')

    // Then
    expect(credentials).toEqual({apiKey: remoteApp.apiKey, clientSecret: SECRET})
    expect(appClientSecrets).not.toHaveBeenCalled()
  })

  test('fetches the secret when the secret flag is empty', async () => {
    // Given
    const appClientSecrets = vi.fn().mockResolvedValue([{secret: 'fetched-secret'}])
    const remoteApp = testOrganizationApp({
      apiSecretKeys: [],
      developerPlatformClient: testDeveloperPlatformClient({appClientSecrets}),
    })

    // When
    const credentials = await collectCredentials(
      {...input, clientSecret: '', clientId: undefined, remoteApp},
      'event-bridge',
    )

    // Then
    expect(credentials).toEqual({apiKey: remoteApp.apiKey, clientSecret: 'fetched-secret'})
    expect(appClientSecrets).toHaveBeenCalledWith(remoteApp)
  })

  test('asks for the secret flag when the Developer Dashboard returns no secret', async () => {
    // Given
    vi.stubEnv('SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'automation-token')
    const inputWithoutSecret = {...input, clientSecret: undefined, remoteApp: testOrganizationAppWithoutClientSecret()}

    // When
    const credentials = collectCredentials(inputWithoutSecret, DELIVERY_METHOD)

    // Then
    await expect(credentials).rejects.toThrow(AbortError)
    await expect(collectCredentials(inputWithoutSecret, DELIVERY_METHOD)).rejects.toMatchObject({
      tryMessage: expect.stringContaining('--client-secret'),
    })
  })

  test('shows the current config when found', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    const app = testAppLinked()

    // When
    await collectCredentials({app, remoteApp: testOrganizationApp()}, DELIVERY_METHOD)

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Using shopify.app.toml for default values:                                  │
      │                                                                              │
      │    • App:             app1                                                   │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })
})
