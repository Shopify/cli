import StoreStripeAuth from './stripe-auth.js'
import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {presentStoreAuthResult} from '../../services/store/auth/result.js'
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

describe('store stripe-auth command', () => {
  test('passes signup JWT through to the auth service', async () => {
    vi.mocked(authenticateStoreWithApp).mockResolvedValue(authResult)
    await StoreStripeAuth.run([
      '--store',
      'shop.myshopify.com',
      '--scopes',
      'read_products',
      '--signup',
      'signed.signup.jwt',
    ])

    expect(authenticateStoreWithApp).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      scopes: 'read_products',
      signup: 'signed.signup.jwt',
    })
    expect(presentStoreAuthResult).toHaveBeenCalledWith(authResult, 'text')
  })

  test('presents JSON when --json is provided', async () => {
    vi.mocked(authenticateStoreWithApp).mockResolvedValue(authResult)
    await StoreStripeAuth.run([
      '--store',
      'shop.myshopify.com',
      '--scopes',
      'read_products',
      '--signup',
      'signed.signup.jwt',
      '--json',
    ])

    expect(presentStoreAuthResult).toHaveBeenCalledWith(authResult, 'json')
  })

  test('defines the expected flags', () => {
    expect(StoreStripeAuth.flags.store).toBeDefined()
    expect(StoreStripeAuth.flags.scopes).toBeDefined()
    expect(StoreStripeAuth.flags.signup).toBeDefined()
    expect(StoreStripeAuth.flags.signup.required).toBe(true)
    expect(StoreStripeAuth.flags.json).toBeDefined()
    expect('port' in StoreStripeAuth.flags).toBe(false)
    expect('client-secret-file' in StoreStripeAuth.flags).toBe(false)
  })
})
