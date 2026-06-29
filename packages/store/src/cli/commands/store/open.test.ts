import StoreOpen from './open.js'
import {openStore} from '../../services/store/open.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/open.js')

describe('store open command', () => {
  test('passes the store flag through to the service', async () => {
    await StoreOpen.run(['--store', 'shop.myshopify.com'])

    expect(openStore).toHaveBeenCalledWith({store: 'shop.myshopify.com'})
  })

  test('defines the expected flags', () => {
    expect(StoreOpen.flags.store).toBeDefined()
  })
})
