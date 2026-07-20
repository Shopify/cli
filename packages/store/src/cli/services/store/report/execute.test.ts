import {runAdminReportQuery, runShopifyqlReportQuery, type AdminStoreGraphQLContext} from './execute.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../auth/config.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/api/graphql')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/api/admin', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/api/admin')>(
    '@shopify/cli-kit/node/api/admin',
  )
  return {
    ...actual,
    adminUrl: vi.fn(),
  }
})

function makeClientErrorLike(errors: {message: string; extensions?: {code: string}}[]): Error {
  const error = new Error('GraphQL Error') as Error & {response: {errors: typeof errors}}
  error.response = {errors}
  return error
}

describe('runShopifyqlReportQuery / runAdminReportQuery', () => {
  const store = 'shop.myshopify.com'
  const context: AdminStoreGraphQLContext = {
    adminSession: {token: 'token', storeFqdn: store},
    version: '2025-10',
    session: {
      store,
      clientId: STORE_AUTH_APP_CLIENT_ID,
      userId: '42',
      accessToken: 'token',
      scopes: ['read_products', 'write_orders'],
      acquiredAt: '2026-03-27T00:00:00.000Z',
    },
  }

  beforeEach(() => {
    vi.mocked(adminUrl).mockImplementation((shop, version) => `https://${shop}/admin/api/${version}/graphql.json`)
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task(() => {}))
  })

  test('runShopifyqlReportQuery returns the table data on success', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({
      shopifyqlQuery: {
        parseErrors: [],
        tableData: {
          columns: [{name: 'total_sales', dataType: 'money', displayName: 'Total sales'}],
          rows: [{total_sales: 100}],
        },
      },
    })

    const outcome = await runShopifyqlReportQuery(context, 'FROM sales SHOW total_sales')

    expect(outcome).toEqual({
      success: true,
      result: {
        columns: [{name: 'total_sales', dataType: 'money', displayName: 'Total sales'}],
        rows: [{total_sales: 100}],
      },
    })
    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({variables: {query: 'FROM sales SHOW total_sales'}}),
    )
  })

  test('runShopifyqlReportQuery returns a failure outcome when ShopifyQL reports parse errors', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({
      shopifyqlQuery: {parseErrors: ['Unknown metric: bogus_metric'], tableData: {columns: [], rows: []}},
    })

    const outcome = await runShopifyqlReportQuery(context, 'FROM sales SHOW bogus_metric')

    expect(outcome).toEqual({
      success: false,
      failure: {
        errorText: 'Unknown metric: bogus_metric',
        accessDenied: false,
        errors: ['Unknown metric: bogus_metric'],
      },
    })
  })

  test('runShopifyqlReportQuery surfaces an access-denied failure without throwing', async () => {
    const errors = [{message: 'requires the `read_reports` scope', extensions: {code: 'ACCESS_DENIED'}}]
    vi.mocked(graphqlRequest).mockRejectedValue(makeClientErrorLike(errors))

    const outcome = await runShopifyqlReportQuery(context, 'FROM sales SHOW total_sales')

    expect(outcome).toEqual({
      success: false,
      failure: {errorText: JSON.stringify(errors), accessDenied: true, errors},
    })
  })

  test('runAdminReportQuery returns the raw response on success', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({shop: {name: 'My Shop'}})

    const outcome = await runAdminReportQuery(context, '{ shop { name } }')

    expect(outcome).toEqual({success: true, result: {shop: {name: 'My Shop'}}})
  })

  test('runAdminReportQuery surfaces a non-access-denied GraphQL failure without throwing', async () => {
    const errors = [{message: 'Field does not exist on type Shop'}]
    vi.mocked(graphqlRequest).mockRejectedValue(makeClientErrorLike(errors))

    const outcome = await runAdminReportQuery(context, '{ shop { bogusField } }')

    expect(outcome).toEqual({
      success: false,
      failure: {errorText: JSON.stringify(errors), accessDenied: false, errors},
    })
  })

  test('runAdminReportQuery rejects a mutation with a store-report-specific message, not the shared store execute one', async () => {
    await expect(
      runAdminReportQuery(context, 'mutation { productCreate(input: {}) { product { id } } }'),
    ).rejects.toMatchObject({message: 'Mutations are not supported by shopify store report.'})
    expect(graphqlRequest).not.toHaveBeenCalled()
  })

  test('runAdminReportQuery rethrows classified errors (like a 402) instead of returning a failure outcome', async () => {
    const error = new Error('Unavailable Shop') as Error & {response: {status: number}}
    error.response = {status: 402}
    vi.mocked(graphqlRequest).mockRejectedValue(error)

    await expect(runAdminReportQuery(context, '{ shop { name } }')).rejects.toBeInstanceOf(AbortError)
  })
})
