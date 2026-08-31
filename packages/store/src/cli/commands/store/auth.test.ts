import StoreAuth from './auth.js'
import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {presentStoreAuthResult} from '../../services/store/auth/result.js'
import {storeAuthJsonOutputSchema} from '../../services/store/auth/types.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/auth/index.js')
vi.mock('../../services/store/attribution.js')
vi.mock('../../services/store/auth/result.js')

const authResult = {
  store: 'shop.myshopify.com',
  userId: '42',
  scopes: ['read_products'],
  acquiredAt: '2026-04-02T00:00:00.000Z',
  hasRefreshToken: true,
}

describe('store auth command', () => {
  test('passes parsed flags through to the auth service', async () => {
    vi.mocked(authenticateStoreWithApp).mockResolvedValue(authResult)
    await StoreAuth.run(['--store', 'shop.myshopify.com', '--scopes', 'read_products,write_products'])

    expect(authenticateStoreWithApp).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      scopes: 'read_products,write_products',
    })
    expect(presentStoreAuthResult).toHaveBeenCalledWith(authResult, 'text')
  })

  test('presents JSON when --json is provided', async () => {
    vi.mocked(authenticateStoreWithApp).mockResolvedValue(authResult)
    await StoreAuth.run(['--store', 'shop.myshopify.com', '--scopes', 'read_products', '--json'])

    expect(presentStoreAuthResult).toHaveBeenCalledWith(authResult, 'json')
  })

  test('defines the expected flags', () => {
    expect(StoreAuth.flags.store).toBeDefined()
    expect(StoreAuth.flags.scopes).toBeDefined()
    expect(StoreAuth.flags.json).toBeDefined()
    expect('signup' in StoreAuth.flags).toBe(false)
    expect('port' in StoreAuth.flags).toBe(false)
    expect('client-secret-file' in StoreAuth.flags).toBe(false)
  })

  test('exposes the JSON output schema', () => {
    expect(StoreAuth.jsonOutputSchema).toBe(storeAuthJsonOutputSchema)
  })
})
