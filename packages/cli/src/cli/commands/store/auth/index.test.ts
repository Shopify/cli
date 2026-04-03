import {describe, test, expect, vi, beforeEach} from 'vitest'
import StoreAuth from './index.js'
import {authenticateStoreWithApp, createStoreAuthPresenter} from '../../../services/store/auth.js'

vi.mock('../../../services/store/auth.js', () => ({
  authenticateStoreWithApp: vi.fn(),
  createStoreAuthPresenter: vi.fn().mockReturnValue('presenter'),
}))

describe('store auth command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createStoreAuthPresenter).mockReturnValue('presenter' as any)
  })

  test('passes parsed flags through to the auth service', async () => {
    await StoreAuth.run(['--store', 'shop.myshopify.com', '--scopes', 'read_products,write_products'])

    expect(authenticateStoreWithApp).toHaveBeenCalledWith(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products,write_products',
      },
      {
        presenter: 'presenter',
      },
    )
    expect(createStoreAuthPresenter).toHaveBeenCalledWith('text')
  })

  test('supports json output', async () => {
    await StoreAuth.run(['--store', 'shop.myshopify.com', '--scopes', 'read_products,write_products', '--json'])

    expect(createStoreAuthPresenter).toHaveBeenCalledWith('json')
  })

  test('defines the expected flags', () => {
    expect(StoreAuth.flags.store).toBeDefined()
    expect(StoreAuth.flags.scopes).toBeDefined()
    expect(StoreAuth.flags.json).toBeDefined()
    expect('port' in StoreAuth.flags).toBe(false)
    expect('client-secret-file' in StoreAuth.flags).toBe(false)
  })
})
