import StoreOpen from './open.js'
import {renderOpenStoreResult} from '../../services/store/open/result.js'
import {openStoreJsonOutputSchema} from '../../services/store/open/types.js'
import {openStore} from '../../services/store/open.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/open.js')
vi.mock('../../services/store/open/result.js')

describe('store open command', () => {
  test('passes the store flag through to the service', async () => {
    await StoreOpen.run(['--store', 'shop.myshopify.com'])

    expect(openStore).toHaveBeenCalledWith({store: 'shop.myshopify.com'})
  })

  test('selects JSON presentation', async () => {
    const result = {store: 'shop.myshopify.com', url: 'https://shop.myshopify.com', opened: false}
    vi.mocked(openStore).mockResolvedValue(result)
    await StoreOpen.run(['--store', result.store, '--json'])
    expect(renderOpenStoreResult).toHaveBeenCalledWith(result, 'json')
  })

  test('exits unsuccessfully without presenting a result when opening fails', async () => {
    vi.mocked(openStore).mockRejectedValue(new Error('Store unavailable'))
    await expect(StoreOpen.run(['--store', 'shop.myshopify.com'])).rejects.toThrow(
      'process.exit unexpectedly called with "1"',
    )
    expect(renderOpenStoreResult).not.toHaveBeenCalled()
  })

  test('defines the expected flags', () => {
    expect(StoreOpen.flags.store).toBeDefined()
    expect(StoreOpen.flags.json).toBeDefined()
    expect(StoreOpen.jsonOutputSchema).toBe(openStoreJsonOutputSchema)
  })
})
