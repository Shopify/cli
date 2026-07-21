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
})
