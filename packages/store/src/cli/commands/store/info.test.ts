import StoreInfo from './info.js'
import {getStoreInfo} from '../../services/store/info/index.js'
import {renderStoreInfoResult} from '../../services/store/info/result.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/info/index.js')
vi.mock('../../services/store/info/result.js')
vi.mock('../../services/store/attribution.js')

describe('store info command', () => {
  beforeEach(() => {
    vi.mocked(getStoreInfo).mockResolvedValue({
      subdomain: 'shop.myshopify.com',
      displayName: 'My Shop',
    })
  })

  test('passes the store flag through to the service', async () => {
    await StoreInfo.run(['--store', 'shop.myshopify.com'])

    expect(getStoreInfo).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
    })
    expect(renderStoreInfoResult).toHaveBeenCalledWith(
      expect.objectContaining({subdomain: 'shop.myshopify.com'}),
      'text',
    )
  })

  test('renders json format when --json flag is set', async () => {
    await StoreInfo.run(['--store', 'shop.myshopify.com', '--json'])

    expect(renderStoreInfoResult).toHaveBeenCalledWith(expect.anything(), 'json')
  })

  test('defines the expected flags', () => {
    expect(StoreInfo.flags.store).toBeDefined()
    expect(StoreInfo.flags.json).toBeDefined()
  })
})
