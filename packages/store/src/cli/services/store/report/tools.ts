import {
  runAdminReportQuery,
  runShopifyqlReportQuery,
  type AdminStoreGraphQLContext,
  type ReportQueryOutcome,
} from './execute.js'
import {parseRequiredScopes, reauthForReportScopes, type ReauthForScopes} from './reauth.js'
import {tool} from '@openai/agents'
import {z} from 'zod'
import type {ReportQueryRecord, StoreReportApi} from './types.js'

/**
 * Names of the two store-query tools, shared with `progress.ts` so it can classify a tool call as a
 * store query (vs. a dev-mcp docs lookup) without duplicating these string literals.
 */
export const RUN_SHOPIFYQL_TOOL_NAME = 'run_shopifyql'
export const RUN_ADMIN_GRAPHQL_TOOL_NAME = 'run_admin_graphql'
export const STORE_QUERY_TOOL_NAMES = [RUN_SHOPIFYQL_TOOL_NAME, RUN_ADMIN_GRAPHQL_TOOL_NAME] as const

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
 * Builds the two CLI-hosted tools the report agent uses to run queries against the store. Both take
 * a single explicit `query` string: the strict function-schema the proxy validates rejects
 * open-ended objects (`z.record`, bare `.optional()`), so the parameters must stay this simple.
 *
 * `reauthForScopes` is injectable so tests can exercise access-denied recovery without opening a
 * browser or hitting the network.
 */
export function createReportTools(
  context: AdminStoreGraphQLContext,
  accumulator: ReportQueryRecord[],
  executors: ReportToolExecutors = defaultReportToolExecutors,
  reauthForScopes: ReauthForScopes = reauthForReportScopes,
) {
  // The session can be refreshed mid-run (see the access-denied recovery below), so both tools read
  // the context through this holder — once we re-auth, every later query uses the new token too.
  let activeContext = context
  // Scopes we've already re-authenticated for this run. A second access-denied on a scope we just
  // requested means re-auth didn't actually grant it, so we stop rather than reopening the browser
  // in a loop.
  const reauthedScopes = new Set<string>()

  /**
   * Runs one query. On an access-denied failure the query itself is fine — the stored token just
   * lacks a scope, which the model can't fix by rewriting the query — so we re-authenticate for the
   * missing scope(s) and retry once. Any other failure is returned to the model as `{error}` (NEVER
   * thrown) so it can self-correct on its next turn. A success is appended to the accumulator (the
   * run's record of ground truth) and its raw result is handed back.
   */
  async function runQuery(
    execute: (ctx: AdminStoreGraphQLContext) => Promise<ReportQueryOutcome<unknown>>,
    api: StoreReportApi,
    query: string,
  ): Promise<unknown> {
    let outcome = await execute(activeContext)

    if (!outcome.success && outcome.failure.accessDenied) {
      const missingScopes = parseRequiredScopes(outcome.failure).filter((scope) => !reauthedScopes.has(scope))
      if (missingScopes.length > 0) {
        missingScopes.forEach((scope) => reauthedScopes.add(scope))
        // `reauthForScopes` returns a complete refreshed context, so this replaces `activeContext`
        // outright rather than merging into it. The agent runs tool calls sequentially, so there is
        // no concurrent writer this reassignment could race with — hence the require-atomic-updates
        // false positive is disabled here.
        const refreshedContext = await reauthForScopes(activeContext, missingScopes)
        // eslint-disable-next-line require-atomic-updates
        activeContext = refreshedContext
        outcome = await execute(refreshedContext)
      }
    }

    if (!outcome.success) return {error: outcome.failure.errorText}

    accumulator.push({api, query, result: outcome.result})
    return outcome.result
  }

  const runShopifyql = tool({
    name: RUN_SHOPIFYQL_TOOL_NAME,
    description:
      'Run a ShopifyQL analytics query against the store and return its table data. Provide ONLY the ShopifyQL ' +
      'string (for example "FROM sales SHOW total_sales SINCE -30d") — never wrap it in a GraphQL query. On ' +
      'failure the error is returned so you can fix the query and try again.',
    parameters: z.object({query: z.string()}),
    async execute({query}) {
      return runQuery((ctx) => executors.runShopifyql(ctx, query), 'shopifyql', query)
    },
  })

  const runAdminGraphql = tool({
    name: RUN_ADMIN_GRAPHQL_TOOL_NAME,
    description:
      'Run a read-only Shopify Admin GraphQL query against the store and return its JSON response. Provide the ' +
      'raw Admin GraphQL query. On failure the error is returned so you can fix the query and try again.',
    parameters: z.object({query: z.string()}),
    async execute({query}) {
      return runQuery((ctx) => executors.runAdmin(ctx, query), 'admin', query)
    },
  })

  return {runShopifyql, runAdminGraphql}
}
