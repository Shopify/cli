import {addressPrompt, apiVersionPrompt, deliveryMethodPrompt, sharedSecretPrompt, topicPrompt} from './trigger.js'
import {DELIVERY_METHOD} from '../../services/webhook/trigger-options.js'
import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest'
import {ui} from '@shopify/cli-kit'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'

beforeEach(() => {
  vi.mock('@shopify/cli-kit')
  vi.mock('@shopify/cli-kit/node/ui')
})

afterEach(async () => {
  vi.clearAllMocks()
})

describe('topicPrompt', () => {
  it('asks the user to enter a topic name', async () => {
    // Given
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('orders/create')

    // When
    const got = await topicPrompt(['orders/create', 'anything/else'])

    // Then
    expect(got).toEqual('orders/create')
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Webhook Topic',
      choices: [
        {label: 'orders/create', value: 'orders/create'},
        {label: 'anything/else', value: 'anything/else'},
      ],
    })
  })
})

describe('apiVersionPrompt', () => {
  it('asks the user to enter an api_version', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({apiVersion: '2022-10'})

    // When
    const got = await apiVersionPrompt(['2023-01', '2022-10', 'unstable'])

    // Then
    expect(got).toEqual('2022-10')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'apiVersion',
        message: 'Webhook ApiVersion',
        choices: [
          {name: '2023-01', value: '2023-01'},
          {name: '2022-10', value: '2022-10'},
          {name: 'unstable', value: 'unstable'},
        ],
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

describe('addressPrompt', () => {
  it('asks the user to enter a destination address', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({address: 'https://example.org'})

    // When
    const got = await addressPrompt(DELIVERY_METHOD.HTTP)

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
        message:
          'Shared Secret to encode the webhook payload. If you are using the app template, this is your Client Secret, which can be found in the partners dashboard',
        default: 'shopify_test',
        validate: expect.any(Function),
      },
    ])
  })
})
