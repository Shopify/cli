import {runReportAgent, type ReportAgentInput} from './agent.js'
import {RunContext} from '@openai/agents'
import {describe, expect, test} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {AdminStoreGraphQLContext} from './execute.js'
import type {ReportToolExecutors} from './tools.js'

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

const baseInput: ReportAgentInput = {
  context,
  question: 'What were my sales in the last 30 days?',
  proxyBaseUrl: 'https://proxy.test/v1',
  proxyToken: 'test-token',
  model: 'gpt-test',
}

describe('runReportAgent', () => {
  test('surfaces the successful query and the model summary as the result', async () => {
    const tableData = {
      columns: [{name: 'total_sales', dataType: 'money', displayName: 'Total sales'}],
      rows: [{total_sales: 100}],
    }
    const executors: ReportToolExecutors = {
      runShopifyql: async () => ({success: true, result: tableData}),
      runAdmin: async () => ({success: false, failure: {errorText: 'unused', accessDenied: false, errors: []}}),
    }

    const result = await runReportAgent(baseInput, {
      executors,
      // Simulate the model deciding to run one ShopifyQL query, then summarizing.
      runAgentLoop: async ({tools}) => {
        await tools.runShopifyql.invoke(
          new RunContext(),
          JSON.stringify({query: 'FROM sales SHOW total_sales SINCE -30d'}),
        )
        return 'Your total sales over the last 30 days were $100.'
      },
    })

    expect(result).toEqual({
      queries: [{api: 'shopifyql', query: 'FROM sales SHOW total_sales SINCE -30d', result: tableData}],
      summary: 'Your total sales over the last 30 days were $100.',
    })
  })

  test('records every successful query, in call order, when the model runs several', async () => {
    const executors: ReportToolExecutors = {
      runShopifyql: async (_context, query) => ({success: true, result: {ranQuery: query}}),
      runAdmin: async () => ({success: false, failure: {errorText: 'unused', accessDenied: false, errors: []}}),
    }

    const result = await runReportAgent(baseInput, {
      executors,
      runAgentLoop: async ({tools}) => {
        await tools.runShopifyql.invoke(new RunContext(), JSON.stringify({query: 'FROM sales SHOW orders'}))
        await tools.runShopifyql.invoke(new RunContext(), JSON.stringify({query: 'FROM sales SHOW total_sales'}))
        return 'done'
      },
    })

    expect(result.queries).toEqual([
      {api: 'shopifyql', query: 'FROM sales SHOW orders', result: {ranQuery: 'FROM sales SHOW orders'}},
      {api: 'shopifyql', query: 'FROM sales SHOW total_sales', result: {ranQuery: 'FROM sales SHOW total_sales'}},
    ])
  })

  test('throws an AbortError when no query ever succeeds', async () => {
    const executors: ReportToolExecutors = {
      runShopifyql: async () => ({
        success: false,
        failure: {errorText: 'Unknown metric: bogus', accessDenied: false, errors: []},
      }),
      runAdmin: async () => ({success: false, failure: {errorText: 'bad', accessDenied: false, errors: []}}),
    }

    await expect(
      runReportAgent(baseInput, {
        executors,
        runAgentLoop: async ({tools}) => {
          await tools.runShopifyql.invoke(new RunContext(), JSON.stringify({query: 'FROM sales SHOW bogus'}))
          return "I couldn't find a query that worked."
        },
      }),
    ).rejects.toMatchObject({message: 'The report agent finished without successfully running any query.'})
  })

  test('the AbortError is a real AbortError instance', async () => {
    const executors: ReportToolExecutors = {
      runShopifyql: async () => ({success: false, failure: {errorText: 'nope', accessDenied: false, errors: []}}),
      runAdmin: async () => ({success: false, failure: {errorText: 'nope', accessDenied: false, errors: []}}),
    }

    await expect(
      runReportAgent(baseInput, {executors, runAgentLoop: async () => 'no queries run'}),
    ).rejects.toBeInstanceOf(AbortError)
  })
})
