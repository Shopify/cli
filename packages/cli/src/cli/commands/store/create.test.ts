import StoreCreate from './create.js'
import {createStore} from '../../services/store/create/index.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderInfo} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/create/index.js')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')

describe('store create command', () => {
  test('passes parsed flags through to the create service with defaults', async () => {
    vi.mocked(createStore).mockResolvedValue({
      shopPermanentDomain: 'my-store.myshopify.com',
      polling: false,
      shopLoginUrl: null,
    })

    await StoreCreate.run([])

    expect(createStore).toHaveBeenCalledWith({
      name: undefined,
      subdomain: undefined,
      country: 'US',
      dev: false,
    })
  })

  test('passes all provided flags through to the create service', async () => {
    vi.mocked(createStore).mockResolvedValue({
      shopPermanentDomain: 'custom.myshopify.com',
      polling: false,
      shopLoginUrl: null,
    })

    await StoreCreate.run(['--name', 'Custom Store', '--subdomain', 'custom', '--country', 'CA', '--dev'])

    expect(createStore).toHaveBeenCalledWith({
      name: 'Custom Store',
      subdomain: 'custom',
      country: 'CA',
      dev: true,
    })
  })

  test('outputs JSON via outputResult when --json is provided', async () => {
    const result = {
      shopPermanentDomain: 'my-store.myshopify.com',
      polling: false,
      shopLoginUrl: null,
    }
    vi.mocked(createStore).mockResolvedValue(result)

    await StoreCreate.run(['--json'])

    expect(outputResult).toHaveBeenCalledWith(JSON.stringify(result, null, 2))
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders success message with store domain when not using --json', async () => {
    vi.mocked(createStore).mockResolvedValue({
      shopPermanentDomain: 'my-store.myshopify.com',
      polling: false,
      shopLoginUrl: 'https://my-store.myshopify.com/admin',
    })

    await StoreCreate.run([])

    expect(renderSuccess).toHaveBeenCalledWith(expect.objectContaining({headline: 'Store created successfully.'}))
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('renders polling info banner when store is still configuring', async () => {
    vi.mocked(createStore).mockResolvedValue({
      shopPermanentDomain: 'my-store.myshopify.com',
      polling: true,
      shopLoginUrl: null,
    })

    await StoreCreate.run([])

    expect(renderSuccess).toHaveBeenCalled()
    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({body: expect.stringContaining('still being configured')}),
    )
  })

  test('defines the expected flags', () => {
    expect(StoreCreate.flags.name).toBeDefined()
    expect(StoreCreate.flags.subdomain).toBeDefined()
    expect(StoreCreate.flags.country).toBeDefined()
    expect(StoreCreate.flags.dev).toBeDefined()
    expect(StoreCreate.flags.json).toBeDefined()
  })
})
