import {beforeEach, describe, expect, test, vi} from 'vitest'
import StoreAuthLogout from './logout.js'
import {displayStoreAuthLogout, logoutStoreAuth} from '../../../services/store/auth-logout.js'

vi.mock('../../../services/store/auth-logout.js', () => ({
  logoutStoreAuth: vi.fn().mockReturnValue({store: 'shop.myshopify.com', cleared: true}),
  displayStoreAuthLogout: vi.fn(),
}))

describe('store auth logout command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(logoutStoreAuth).mockReturnValue({store: 'shop.myshopify.com', cleared: true})
  })

  test('passes parsed flags through to the auth logout service', async () => {
    await StoreAuthLogout.run(['--store', 'shop.myshopify.com'])

    expect(logoutStoreAuth).toHaveBeenCalledWith('shop.myshopify.com')
    expect(displayStoreAuthLogout).toHaveBeenCalledWith({store: 'shop.myshopify.com', cleared: true}, 'text')
  })

  test('normalizes the store flag before calling the auth logout service', async () => {
    await StoreAuthLogout.run(['--store', 'https://shop.myshopify.com/admin'])

    expect(logoutStoreAuth).toHaveBeenCalledWith('shop.myshopify.com')
  })

  test('supports json output', async () => {
    await StoreAuthLogout.run(['--store', 'shop.myshopify.com', '--json'])

    expect(displayStoreAuthLogout).toHaveBeenCalledWith({store: 'shop.myshopify.com', cleared: true}, 'json')
  })

  test('defines the expected flags', () => {
    expect(StoreAuthLogout.flags.store).toBeDefined()
    expect(StoreAuthLogout.flags.json).toBeDefined()
  })
})
