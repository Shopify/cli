import {
  addressPrompt,
  apiVersionPrompt,
  deliveryMethodPrompt,
  localPortPrompt,
  localUrlPathPrompt,
  sharedSecretPrompt,
  topicPrompt,
} from './event-topic.js'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {ui} from '@shopify/cli-kit'

beforeEach(() => {
  vi.mock('@shopify/cli-kit')
})

describe('topicPrompt', () => {
  it('asks the user to enter a topic name', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({topic: 'orders/create'})

    // When
    const got = await topicPrompt()

    // Then
    expect(got).toEqual('orders/create')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'topic',
        message: 'Webhook Topic Name',
        default: '',
        validate: expect.any(Function),
      },
    ])
  })
})

describe('apiVersionPrompt', () => {
  it('asks the user to enter an api_version', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({apiVersion: '2022-01'})

    // When
    const got = await apiVersionPrompt()

    // Then
    expect(got).toEqual('2022-01')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'apiVersion',
        message: 'Webhook ApiVersion',
        default: '2022-07',
      },
    ])
  })
})

describe('deliveryMethodPrompt', () => {
  it('asks the user to select a delivery method', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({value: 'http'})

    // When
    const got = await deliveryMethodPrompt()

    // Then
    expect(got).toEqual('http')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'value',
        message: 'Delivery method',
        choices: [
          {name: 'HTTP', value: 'http'},
          {name: 'Google Pub/Sub', value: 'google-pub-sub'},
          {name: 'Amazon EventBridge', value: 'event-bridge'},
        ],
      },
    ])
  })
})

describe('localPortPrompt', () => {
  it('asks the user to enter a local port with no suggestion', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({port: '1234'})

    // When
    const got = await localPortPrompt()

    // Then
    expect(got).toEqual('1234')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'port',
        message: 'Port for localhost delivery',
        default: '',
        validate: expect.any(Function),
      },
    ])
  })

  it('asks the user to enter a local port with suggestion', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({port: '1234'})

    // When
    const got = await localPortPrompt('8080')

    // Then
    expect(got).toEqual('1234')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'port',
        message: 'Port for localhost delivery',
        default: '8080',
        validate: expect.any(Function),
      },
    ])
  })
})

describe('localUrlPathPrompt', () => {
  it('asks the user to enter url-path with default suggestion', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({urlPath: '/a/path'})

    // When
    const got = await localUrlPathPrompt()

    // Then
    expect(got).toEqual('/a/path')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'urlPath',
        message: 'URL path for localhost delivery',
        default: '/api/webhooks',
      },
    ])
  })

  it('asks the user to enter url-path with custom suggestion', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({urlPath: '/a/path'})

    // When
    const got = await localUrlPathPrompt('/another/path')

    // Then
    expect(got).toEqual('/a/path')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'urlPath',
        message: 'URL path for localhost delivery',
        default: '/another/path',
      },
    ])
  })

  it('adds leading slash in the url-path', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({urlPath: 'a/path'})

    // When
    const got = await localUrlPathPrompt()

    // Then
    expect(got).toEqual('/a/path')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'urlPath',
        message: 'URL path for localhost delivery',
        default: '/api/webhooks',
      },
    ])
  })
})

describe('addressPrompt', () => {
  it('asks the user to enter a destination address with no suggestion', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({address: 'https://example.org'})

    // When
    const got = await addressPrompt()

    // Then
    expect(got).toEqual('https://example.org')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'address',
        message: 'Address for delivery',
        default: '',
        validate: expect.any(Function),
      },
    ])
  })

  it('asks the user to enter a destination address with suggestion', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({address: 'https://example.org'})

    // When
    const got = await addressPrompt('http://localhost')

    // Then
    expect(got).toEqual('https://example.org')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'address',
        message: 'Address for delivery',
        default: 'http://localhost',
        validate: expect.any(Function),
      },
    ])
  })
})

describe('sharedSecretPrompt', () => {
  it('asks the user to enter shared_secret', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({sharedSecret: 'a_secret'})

    // When
    const got = await sharedSecretPrompt()

    // Then
    expect(got).toEqual('a_secret')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'sharedSecret',
        message: 'Shared Secret to endcode the webhook payload',
        default: 'shopify_test',
      },
    ])
  })
})
