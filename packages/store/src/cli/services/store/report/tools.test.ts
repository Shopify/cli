import {createReportTools, type ReportToolExecutors} from './tools.js'
import {RunContext} from '@openai/agents'
import {describe, expect, test} from 'vitest'
import type {AdminStoreGraphQLContext} from './execute.js'
import type {ReportQueryRecord} from './types.js'

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

// The executors are injected, so a runner that gets called signals the wrong tool ran.
function failIfCalled(): never {
  throw new Error('the wrong query runner was called')
}

describe('createReportTools', () => {
  test('run_shopifyql records a successful query and returns its table data to the model', async () => {
    const tableData = {
      columns: [{name: 'total_sales', dataType: 'money', displayName: 'Total sales'}],
      rows: [{total_sales: 100}],
    }
    const executors: ReportToolExecutors = {
      runShopifyql: async () => ({success: true, result: tableData}),
      runAdmin: failIfCalled,
    }
    const accumulator: ReportQueryRecord[] = []
    const {runShopifyql} = createReportTools(context, accumulator, executors)

    const output = await runShopifyql.invoke(new RunContext(), JSON.stringify({query: 'FROM sales SHOW total_sales'}))

    expect(output).toEqual(tableData)
    expect(accumulator).toEqual([{api: 'shopifyql', query: 'FROM sales SHOW total_sales', result: tableData}])
  })

  test('run_admin_graphql returns a failure to the model without throwing or recording it', async () => {
    const executors: ReportToolExecutors = {
      runShopifyql: failIfCalled,
      runAdmin: async () => ({
        success: false,
        failure: {errorText: 'Field does not exist on type Shop', accessDenied: false, errors: []},
      }),
    }
    const accumulator: ReportQueryRecord[] = []
    const {runAdminGraphql} = createReportTools(context, accumulator, executors)

    const output = await runAdminGraphql.invoke(new RunContext(), JSON.stringify({query: '{ shop { bogus } }'}))

    expect(output).toEqual({error: 'Field does not exist on type Shop'})
    expect(accumulator).toEqual([])
  })

  const accessDenied = {
    errorText: 'Access denied for shopifyqlQuery field. Required access: `read_reports` access scope.',
    accessDenied: true,
    errors: [],
  } as const

  test('re-authenticates for the missing scope and retries once when a query is access-denied', async () => {
    const tableData = {
      columns: [{name: 'total_sales', dataType: 'money', displayName: 'Total sales'}],
      rows: [{total_sales: 100}],
    }
    let attempts = 0
    const executors: ReportToolExecutors = {
      // Deny the first attempt, then succeed once the retry carries the refreshed token.
      runShopifyql: async (ctx) => {
        attempts += 1
        if (attempts === 1) return {success: false, failure: {...accessDenied}}
        expect(ctx.adminSession.token).toBe('token-with-read-reports')
        return {success: true, result: tableData}
      },
      runAdmin: failIfCalled,
    }
    const reauthedScopes: string[][] = []
    const reauthForScopes = async (ctx: AdminStoreGraphQLContext, scopes: string[]) => {
      reauthedScopes.push(scopes)
      return {...ctx, adminSession: {token: 'token-with-read-reports', storeFqdn: 'shop.myshopify.com'}}
    }
    const accumulator: ReportQueryRecord[] = []
    const {runShopifyql} = createReportTools(context, accumulator, executors, reauthForScopes)

    const output = await runShopifyql.invoke(new RunContext(), JSON.stringify({query: 'FROM sales SHOW total_sales'}))

    expect(reauthedScopes).toEqual([['read_reports']])
    expect(output).toEqual(tableData)
    expect(accumulator).toEqual([{api: 'shopifyql', query: 'FROM sales SHOW total_sales', result: tableData}])
  })

  test('re-authenticates only once for a scope that is still denied afterward', async () => {
    const executors: ReportToolExecutors = {
      runShopifyql: async () => ({success: false, failure: {...accessDenied}}),
      runAdmin: failIfCalled,
    }
    let reauthCount = 0
    const reauthForScopes = async () => {
      reauthCount += 1
      return context
    }
    const {runShopifyql} = createReportTools(context, [], executors, reauthForScopes)

    const first = await runShopifyql.invoke(new RunContext(), JSON.stringify({query: 'FROM sales SHOW total_sales'}))
    const second = await runShopifyql.invoke(new RunContext(), JSON.stringify({query: 'FROM sales SHOW orders'}))

    // The first denial triggers re-auth and a retry; both calls end up returning the error to the
    // model, and the already-requested scope is never re-authenticated again.
    expect(reauthCount).toBe(1)
    expect(first).toEqual({error: accessDenied.errorText})
    expect(second).toEqual({error: accessDenied.errorText})
  })

  test('returns the error without re-authenticating when the failure names no scope', async () => {
    const executors: ReportToolExecutors = {
      runShopifyql: async () => ({success: false, failure: {errorText: 'Throttled', accessDenied: true, errors: []}}),
      runAdmin: failIfCalled,
    }
    let reauthCount = 0
    const reauthForScopes = async () => {
      reauthCount += 1
      return context
    }
    const {runShopifyql} = createReportTools(context, [], executors, reauthForScopes)

    const output = await runShopifyql.invoke(new RunContext(), JSON.stringify({query: 'FROM sales SHOW total_sales'}))

    expect(reauthCount).toBe(0)
    expect(output).toEqual({error: 'Throttled'})
  })
})
