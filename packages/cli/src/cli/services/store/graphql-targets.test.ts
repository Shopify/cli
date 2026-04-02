import {prepareStoreExecuteRequest} from './execute-request.js'
import {prepareAdminStoreGraphQLContext} from './admin-graphql-context.js'
import {runAdminStoreGraphQLOperation} from './admin-graphql-transport.js'
import {getStoreGraphQLTarget} from './graphql-targets.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./admin-graphql-context.js')
vi.mock('./admin-graphql-transport.js')

describe('getStoreGraphQLTarget', () => {
  test('returns the admin target adapter', async () => {
    const target = getStoreGraphQLTarget('admin')
    const request = await prepareStoreExecuteRequest({query: 'query { shop { name } }'})
    const context = {
      adminSession: {token: 'token', storeFqdn: 'shop.myshopify.com'},
      version: '2025-10',
      sessionUserId: '42',
    }

    vi.mocked(prepareAdminStoreGraphQLContext).mockResolvedValue(context)
    vi.mocked(runAdminStoreGraphQLOperation).mockResolvedValue({data: {shop: {name: 'Test shop'}}})

    await expect(target.prepareContext({store: 'shop.myshopify.com', requestedVersion: '2025-10'})).resolves.toEqual(
      context,
    )

    await expect(target.execute({store: 'shop.myshopify.com', context, request})).resolves.toEqual({
      data: {shop: {name: 'Test shop'}},
    })

    expect(prepareAdminStoreGraphQLContext).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      userSpecifiedVersion: '2025-10',
    })
    expect(runAdminStoreGraphQLOperation).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      adminSession: context.adminSession,
      sessionUserId: context.sessionUserId,
      version: context.version,
      request,
    })
  })
})
