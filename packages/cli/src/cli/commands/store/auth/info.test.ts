import {beforeEach, describe, expect, test, vi} from 'vitest'
import StoreAuthInfo from './info.js'
import {showStoreAuthInfo} from '../../../services/store/auth-info.js'

vi.mock('../../../services/store/auth-info.js')

describe('store auth info command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('passes parsed flags through to the auth info service', async () => {
    await StoreAuthInfo.run(['--store', 'shop.myshopify.com'])

    expect(showStoreAuthInfo).toHaveBeenCalledWith('shop.myshopify.com', 'text')
  })

  test('normalizes the store flag before calling the auth info service', async () => {
    await StoreAuthInfo.run(['--store', 'https://shop.myshopify.com/admin'])

    expect(showStoreAuthInfo).toHaveBeenCalledWith('shop.myshopify.com', 'text')
  })

  test('supports json output', async () => {
    await StoreAuthInfo.run(['--store', 'shop.myshopify.com', '--json'])

    expect(showStoreAuthInfo).toHaveBeenCalledWith('shop.myshopify.com', 'json')
  })

  test('defines the expected flags', () => {
    expect(StoreAuthInfo.flags.store).toBeDefined()
    expect(StoreAuthInfo.flags.json).toBeDefined()
  })
})
