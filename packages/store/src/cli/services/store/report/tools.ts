import {
  runAdminReportQuery,
  runShopifyqlReportQuery,
  type AdminStoreGraphQLContext,
  type ReportQueryOutcome,
} from './execute.js'
import {tool} from '@openai/agents'
import {z} from 'zod'
import type {ReportQueryRecord, StoreReportApi} from './types.js'

/**
 * The store-side query runners the tools delegate to. Injectable so unit tests can supply fakes
 * that return canned outcomes without touching the network.
 */
export interface ReportToolExecutors {
  runShopifyql: (context: AdminStoreGraphQLContext, query: string) => Promise<ReportQueryOutcome<unknown>>
  runAdmin: (context: AdminStoreGraphQLContext, query: string) => Promise<ReportQueryOutcome<unknown>>
}

const defaultReportToolExecutors: ReportToolExecutors = {
  runShopifyql: runShopifyqlReportQuery,
  runAdmin: runAdminReportQuery,
}

/**
 * Runs one query and turns the outcome into the value the model receives back from the tool. A
 * failure is returned to the model as `{error}` — NEVER thrown — so the model sees the error and
 * can self-correct on its next turn instead of the whole run aborting. On success the query is
 * appended to the accumulator (the run's record of ground truth) and the raw result is handed back.
 */
async function executeAndRecord(
  run: () => Promise<ReportQueryOutcome<unknown>>,
  api: StoreReportApi,
  query: string,
  accumulator: ReportQueryRecord[],
): Promise<unknown> {
  const outcome = await run()
  if (!outcome.success) return {error: outcome.failure.errorText}

  accumulator.push({api, query, result: outcome.result})
  return outcome.result
}

/**
 * Builds the two CLI-hosted tools the report agent uses to run queries against the store. Both take
 * a single explicit `query` string: the strict function-schema the proxy validates rejects
 * open-ended objects (`z.record`, bare `.optional()`), so the parameters must stay this simple.
 */
export function createReportTools(
  context: AdminStoreGraphQLContext,
  accumulator: ReportQueryRecord[],
  executors: ReportToolExecutors = defaultReportToolExecutors,
) {
  const runShopifyql = tool({
    name: 'run_shopifyql',
    description:
      'Run a ShopifyQL analytics query against the store and return its table data. Provide ONLY the ShopifyQL ' +
      'string (for example "FROM sales SHOW total_sales SINCE -30d") — never wrap it in a GraphQL query. On ' +
      'failure the error is returned so you can fix the query and try again.',
    parameters: z.object({query: z.string()}),
    async execute({query}) {
      return executeAndRecord(() => executors.runShopifyql(context, query), 'shopifyql', query, accumulator)
    },
  })

  const runAdminGraphql = tool({
    name: 'run_admin_graphql',
    description:
      'Run a read-only Shopify Admin GraphQL query against the store and return its JSON response. Provide the ' +
      'raw Admin GraphQL query. On failure the error is returned so you can fix the query and try again.',
    parameters: z.object({query: z.string()}),
    async execute({query}) {
      return executeAndRecord(() => executors.runAdmin(context, query), 'admin', query, accumulator)
    },
  })

  return {runShopifyql, runAdminGraphql}
}
