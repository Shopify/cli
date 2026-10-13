import StoreAuth from './auth.js'
import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {createStoreAuthPresenter} from '../../services/store/auth/result.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/auth/index.js')
vi.mock('../../services/store/attribution.js')
vi.mock('../../services/store/auth/result.js', () => ({
  createStoreAuthPresenter: vi.fn((format: 'text' | 'json') => ({format})),
}))

describe('store auth command', () => {
  test('passes parsed flags through to the auth service', async () => {
    await StoreAuth.run(['--store', 'shop.myshopify.com', '--scopes', 'read_products,write_products'])

    expect(createStoreAuthPresenter).toHaveBeenCalledWith('text')
    expect(authenticateStoreWithApp).toHaveBeenCalledWith(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products,write_products',
      },
      {presenter: {format: 'text'}},
    )
  })

  test('defines the expected flags', () => {
    expect(StoreAuth.flags.store).toBeDefined()
    expect(StoreAuth.flags.scopes).toBeDefined()
    expect('signup' in StoreAuth.flags).toBe(false)
    expect('port' in StoreAuth.flags).toBe(false)
    expect('client-secret-file' in StoreAuth.flags).toBe(false)
  })
})
