import {addressPrompt, apiVersionPrompt, deliveryMethodPrompt, sharedSecretPrompt, topicPrompt} from './trigger.js'
import {DELIVERY_METHOD} from '../../services/webhook/trigger-options.js'
import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest'
import {renderAutocompletePrompt, renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

beforeEach(() => {
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
    vi.mocked(renderSelectPrompt).mockResolvedValue('2022-10')

    // When
    const got = await apiVersionPrompt(['2023-01', '2022-10', 'unstable'])

    // Then
    expect(got).toEqual('2022-10')
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Webhook ApiVersion',
      choices: [
        {label: '2023-01', value: '2023-01'},
        {label: '2022-10', value: '2022-10'},
        {label: 'unstable', value: 'unstable'},
      ],
    })
  })
})

describe('deliveryMethodPrompt', () => {
  it('asks the user to select a delivery method', async () => {
    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValue('http')

    // When
    const got = await deliveryMethodPrompt()

    // Then
    expect(got).toEqual('http')
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Delivery method',
      choices: [
        {label: 'HTTP', value: 'http'},
        {label: 'Google Pub/Sub', value: 'google-pub-sub'},
        {label: 'Amazon EventBridge', value: 'event-bridge'},
      ],
    })
  })
})

describe('addressPrompt', () => {
  it('asks the user to enter a destination address', async () => {
    // Given
    vi.mocked(renderTextPrompt).mockResolvedValue('https://example.org')

    // When
    const got = await addressPrompt(DELIVERY_METHOD.HTTP)

    // Then
    expect(got).toEqual('https://example.org')
    expect(renderTextPrompt).toHaveBeenCalledWith({
      message: 'Address for delivery',
      validate: expect.any(Function),
    })
  })
})

describe('sharedSecretPrompt', () => {
  it('asks the user to enter shared_secret', async () => {
    // Given
    vi.mocked(renderTextPrompt).mockResolvedValue('a_secret')

    // When
    const got = await sharedSecretPrompt()

    // Then
    expect(got).toEqual('a_secret')
    expect(renderTextPrompt).toHaveBeenCalledWith({
      message:
        'Shared Secret to encode the webhook payload. If you are using the app template, this is your Client Secret, which can be found in the partners dashboard',
      defaultValue: 'shopify_test',
      validate: expect.any(Function),
    })
  })
})
