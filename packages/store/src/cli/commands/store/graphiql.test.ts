import StoreGraphiQL from './graphiql.js'
import {openStoreGraphiQL} from '../../services/store/execute/graphiql.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/execute/graphiql.js', () => ({openStoreGraphiQL: vi.fn()}))
vi.mock('../../services/store/attribution.js')

describe('store graphiql command', () => {
  beforeEach(() => {
    vi.mocked(openStoreGraphiQL).mockResolvedValue()
  })

  test('opens GraphiQL with mutations disabled by default', async () => {
    await StoreGraphiQL.run(['--store', 'shop.myshopify.com'])

    expect(openStoreGraphiQL).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      port: undefined,
      allowMutations: false,
      variables: undefined,
      apiVersion: undefined,
    })
  })

  test('forwards optional GraphiQL configuration', async () => {
    await StoreGraphiQL.run([
      '--store',
      'shop.myshopify.com',
      '--port',
      '9123',
      '--allow-mutations',
      '--variables',
      '{"id":"gid://shopify/Product/1"}',
      '--version',
      '2024-10',
    ])

    expect(openStoreGraphiQL).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      port: 9123,
      allowMutations: true,
      variables: '{"id":"gid://shopify/Product/1"}',
      apiVersion: '2024-10',
    })
  })
})
