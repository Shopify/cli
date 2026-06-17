import StoreStripeAuth from './stripe-auth.js'
import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {createStoreAuthPresenter} from '../../services/store/auth/result.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/auth/index.js')
vi.mock('../../services/store/attribution.js')
vi.mock('../../services/store/auth/result.js', () => ({
  createStoreAuthPresenter: vi.fn((format: 'text' | 'json') => ({format})),
}))

describe('store stripe-auth command', () => {
  test('passes signup JWT through to the auth service', async () => {
    await StoreStripeAuth.run([
      '--store',
      'shop.myshopify.com',
      '--scopes',
      'read_products',
      '--signup',
      'signed.signup.jwt',
    ])

    expect(createStoreAuthPresenter).toHaveBeenCalledWith('text')
    expect(authenticateStoreWithApp).toHaveBeenCalledWith(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products',
        signup: 'signed.signup.jwt',
      },
      {presenter: {format: 'text'}},
    )
  })

  test('passes a json presenter when --json is provided', async () => {
    await StoreStripeAuth.run([
      '--store',
      'shop.myshopify.com',
      '--scopes',
      'read_products',
      '--signup',
      'signed.signup.jwt',
      '--json',
    ])

    expect(createStoreAuthPresenter).toHaveBeenCalledWith('json')
    expect(authenticateStoreWithApp).toHaveBeenCalledWith(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products',
        signup: 'signed.signup.jwt',
      },
      {presenter: {format: 'json'}},
    )
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
