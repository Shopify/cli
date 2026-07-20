import {runStoreReport} from './index.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {AdminStoreGraphQLContext, ReportQueryOutcome} from './execute.js'

vi.mock('../attribution.js')

describe('runStoreReport', () => {
  const context: AdminStoreGraphQLContext = {
    adminSession: {token: 'token', storeFqdn: 'shop.myshopify.com'},
    version: '2025-10',
    session: {
      store: 'shop.myshopify.com',
      clientId: 'client-id',
      userId: 'user-id',
      accessToken: 'token',
      scopes: [],
      acquiredAt: '2026-06-15T00:00:00Z',
    },
  }

  const prepareContext = vi.fn().mockResolvedValue(context)
  const askAssistant = vi.fn()
  const runShopifyqlQuery = vi.fn()
  const runAdminQuery = vi.fn()

  const dependencies = {prepareContext, askAssistant, runShopifyqlQuery, runAdminQuery}

  beforeEach(() => {
    prepareContext.mockClear().mockResolvedValue(context)
    askAssistant.mockReset()
    runShopifyqlQuery.mockReset()
    runAdminQuery.mockReset()
  })

  test('resolves the assistant query and returns the ShopifyQL result on the first try', async () => {
    askAssistant.mockResolvedValue(
      '{"api": "shopifyql", "query": "FROM sales SHOW total_sales", "rationale": "sales trend"}',
    )
    const tableData = {
      columns: [{name: 'total_sales', dataType: 'money', displayName: 'Total sales'}],
      rows: [{total_sales: 100}],
    }
    runShopifyqlQuery.mockResolvedValue({success: true, result: tableData} satisfies ReportQueryOutcome<unknown>)

    const result = await runStoreReport(
      {store: 'shop.myshopify.com', analysis: 'What were my sales last month?'},
      dependencies,
    )

    expect(result).toEqual({
      store: 'shop.myshopify.com',
      apiVersion: '2025-10',
      question: 'What were my sales last month?',
      api: 'shopifyql',
      query: 'FROM sales SHOW total_sales',
      rationale: 'sales trend',
      result: tableData,
    })
    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith('shop.myshopify.com', false)
    expect(prepareContext).toHaveBeenCalledWith({store: 'shop.myshopify.com', userSpecifiedVersion: undefined})
    expect(runAdminQuery).not.toHaveBeenCalled()
    expect(askAssistant).toHaveBeenCalledTimes(1)
  })

  test('locks the assistant to the forced api and dispatches to the admin runner', async () => {
    askAssistant.mockResolvedValue('{"api": "admin", "query": "{ shop { name } }", "rationale": "direct lookup"}')
    runAdminQuery.mockResolvedValue({
      success: true,
      result: {shop: {name: 'My Shop'}},
    } satisfies ReportQueryOutcome<unknown>)

    const result = await runStoreReport(
      {store: 'shop.myshopify.com', analysis: 'What is my shop name?', api: 'admin'},
      dependencies,
    )

    expect(result.api).toBe('admin')
    expect(askAssistant).toHaveBeenCalledWith(expect.stringContaining('This run is locked to the "admin" api'))
    expect(runShopifyqlQuery).not.toHaveBeenCalled()
  })

  test('never runs the wrong surface when a disobedient assistant ignores the forced api, and aborts', async () => {
    // Forced "admin", but the assistant disobeys and always replies with "shopifyql" — on both the
    // initial attempt and the retry. Neither runner may ever be called with the wrong query.
    askAssistant.mockResolvedValue('{"api": "shopifyql", "query": "FROM sales SHOW total_sales"}')

    await expect(
      runStoreReport({store: 'shop.myshopify.com', analysis: 'What is my shop name?', api: 'admin'}, dependencies),
    ).rejects.toMatchObject({message: 'The assistant did not honor the required "admin" api, even after a retry.'})

    expect(runShopifyqlQuery).not.toHaveBeenCalled()
    expect(runAdminQuery).not.toHaveBeenCalled()
    expect(askAssistant).toHaveBeenCalledTimes(2)
    expect(askAssistant.mock.calls[1]![0]).toContain('locked to the "admin" api')
    expect(askAssistant.mock.calls[1]![0]).toContain('You must set "api" to "admin"')
  })

  test('retries once with the failure context when the first query fails, then succeeds', async () => {
    askAssistant
      .mockResolvedValueOnce('{"api": "shopifyql", "query": "FROM sales SHOW bogus_metric"}')
      .mockResolvedValueOnce('{"api": "shopifyql", "query": "FROM sales SHOW total_sales"}')
    runShopifyqlQuery
      .mockResolvedValueOnce({
        success: false,
        failure: {errorText: 'Unknown metric: bogus_metric', accessDenied: false, errors: []},
      } satisfies ReportQueryOutcome<unknown>)
      .mockResolvedValueOnce({success: true, result: {columns: [], rows: []}} satisfies ReportQueryOutcome<unknown>)

    const result = await runStoreReport(
      {store: 'shop.myshopify.com', analysis: 'What were my sales last month?'},
      dependencies,
    )

    expect(result.query).toBe('FROM sales SHOW total_sales')
    expect(askAssistant).toHaveBeenCalledTimes(2)
    expect(askAssistant.mock.calls[1]![0]).toContain('Retry instructions: your previous "shopifyql" query failed:')
    expect(askAssistant.mock.calls[1]![0]).toContain('FROM sales SHOW bogus_metric')
    expect(askAssistant.mock.calls[1]![0]).toContain('Unknown metric: bogus_metric')
  })

  test('throws an actionable AbortError immediately on an access-denied failure, without retrying', async () => {
    askAssistant.mockResolvedValue('{"api": "shopifyql", "query": "FROM sales SHOW total_sales"}')
    runShopifyqlQuery.mockResolvedValue({
      success: false,
      failure: {errorText: 'Access denied', accessDenied: true, errors: []},
    } satisfies ReportQueryOutcome<unknown>)

    await expect(
      runStoreReport({store: 'shop.myshopify.com', analysis: 'What were my sales last month?'}, dependencies),
    ).rejects.toMatchObject({
      message: "Stored app authentication for shop.myshopify.com isn't authorized to run this ShopifyQL query.",
      nextSteps: [
        [
          'Run',
          {command: 'shopify store auth --store shop.myshopify.com --scopes read_reports'},
          'to grant the required scope',
        ],
      ],
    })
    expect(askAssistant).toHaveBeenCalledTimes(1)
  })

  test('throws an actionable AbortError when the retry attempt is access-denied', async () => {
    askAssistant.mockResolvedValue('{"api": "admin", "query": "{ orders { edges { node { id } } } }"}')
    runAdminQuery
      .mockResolvedValueOnce({
        success: false,
        failure: {errorText: 'boom', accessDenied: false, errors: []},
      } satisfies ReportQueryOutcome<unknown>)
      .mockResolvedValueOnce({
        success: false,
        failure: {
          errorText: 'Access denied',
          accessDenied: true,
          errors: [{message: 'requires the `read_orders` scope'}],
        },
      } satisfies ReportQueryOutcome<unknown>)

    await expect(
      runStoreReport({store: 'shop.myshopify.com', analysis: 'List my orders'}, dependencies),
    ).rejects.toMatchObject({
      message: "Stored app authentication for shop.myshopify.com isn't authorized to run this Admin GraphQL query.",
      nextSteps: [
        [
          'Run',
          {command: 'shopify store auth --store shop.myshopify.com --scopes read_orders'},
          'to grant the required scope',
        ],
      ],
    })
    expect(askAssistant).toHaveBeenCalledTimes(2)
  })

  test('throws a generic AbortError when the retry also fails without being access-denied', async () => {
    askAssistant.mockResolvedValue('{"api": "shopifyql", "query": "FROM sales SHOW total_sales"}')
    runShopifyqlQuery.mockResolvedValue({
      success: false,
      failure: {errorText: 'Unknown metric: total_sales', accessDenied: false, errors: []},
    } satisfies ReportQueryOutcome<unknown>)

    let captured: AbortError | undefined
    await runStoreReport({store: 'shop.myshopify.com', analysis: 'What were my sales last month?'}, dependencies).catch(
      (error) => {
        captured = error as AbortError
      },
    )

    expect(captured).toBeInstanceOf(AbortError)
    expect(captured?.message).toBe('The report query failed again after one retry.')
    expect(askAssistant).toHaveBeenCalledTimes(2)
    expect(runShopifyqlQuery).toHaveBeenCalledTimes(2)
  })
})
