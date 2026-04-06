import {beforeEach, describe, expect, test, vi} from 'vitest'
import {prepareStoreExecuteRequest} from './request.js'
import {prepareAdminStoreGraphQLContext} from './admin-context.js'
import {runAdminStoreGraphQLOperation} from './admin-transport.js'
import {getStoreGraphQLTarget} from './targets.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../auth/config.js'

vi.mock('./admin-context.js')
vi.mock('./admin-transport.js')

describe('getStoreGraphQLTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns the admin target adapter', async () => {
    const target = getStoreGraphQLTarget('admin')
    const request = await prepareStoreExecuteRequest({query: 'query { shop { name } }'})
    const context = {
      adminSession: {token: 'token', storeFqdn: 'shop.myshopify.com'},
      version: '2025-10',
      session: {
        store: 'shop.myshopify.com',
        clientId: STORE_AUTH_APP_CLIENT_ID,
        userId: '42',
        accessToken: 'token',
        scopes: ['read_products'],
        acquiredAt: '2026-03-27T00:00:00.000Z',
      },
    }

    vi.mocked(prepareAdminStoreGraphQLContext).mockResolvedValue(context)
    vi.mocked(runAdminStoreGraphQLOperation).mockResolvedValue({data: {shop: {name: 'Test shop'}}})

    await expect(target.prepareContext({store: 'shop.myshopify.com', requestedVersion: '2025-10'})).resolves.toEqual(context)
    await expect(target.execute({context, request})).resolves.toEqual({data: {shop: {name: 'Test shop'}}})

    expect(prepareAdminStoreGraphQLContext).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      userSpecifiedVersion: '2025-10',
    })
    expect(runAdminStoreGraphQLOperation).toHaveBeenCalledWith({context, request})
  })
})
