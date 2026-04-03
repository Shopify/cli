import {describe, test, expect, vi, beforeEach} from 'vitest'
import StoreAuth from './index.js'
import {authenticateStoreWithApp} from '../../../services/store/auth.js'

vi.mock('../../../services/store/auth.js')

describe('store auth command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('passes parsed flags through to the auth service', async () => {
    await StoreAuth.run(['--store', 'shop.myshopify.com', '--scopes', 'read_products,write_products'])

    expect(authenticateStoreWithApp).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      scopes: 'read_products,write_products',
    })
  })

  test('defines the expected flags', () => {
    expect(StoreAuth.flags.store).toBeDefined()
    expect(StoreAuth.flags.scopes).toBeDefined()
    expect('port' in StoreAuth.flags).toBe(false)
    expect('client-secret-file' in StoreAuth.flags).toBe(false)
  })
})
