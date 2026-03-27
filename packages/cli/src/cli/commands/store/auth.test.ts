import {describe, test, expect, vi, beforeEach} from 'vitest'
import StoreAuth from './auth.js'
import {authenticateStoreWithApp} from '../../services/store/auth.js'

vi.mock('../../services/store/auth.js')

describe('store auth command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('passes parsed flags through to the auth service', async () => {
    await StoreAuth.run([
      '--store',
      'shop.myshopify.com',
      '--scopes',
      'read_products,write_products',
      '--client-secret-file',
      './client-secret.txt',
    ])

    expect(authenticateStoreWithApp).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      scopes: 'read_products,write_products',
      clientSecretFile: expect.stringContaining('client-secret.txt'),
      port: 3458,
    })
  })

  test('defines the expected flags', () => {
    expect(StoreAuth.flags.store).toBeDefined()
    expect(StoreAuth.flags.scopes).toBeDefined()
    expect(StoreAuth.flags['client-secret-file']).toBeDefined()
    expect(StoreAuth.flags.port).toBeDefined()
  })
})
