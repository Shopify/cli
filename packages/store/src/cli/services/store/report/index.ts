import {buildReportPrompt} from './prompt.js'
import {parseAssistantReportResponse} from './parse.js'
import {askAssistant} from './assistant.js'
import {
  prepareAdminStoreGraphQLContext,
  runAdminReportQuery,
  runShopifyqlReportQuery,
  type AdminStoreGraphQLContext,
  type ReportQueryFailure,
  type ReportQueryOutcome,
} from './execute.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {ParsedReportQuery, StoreReportApi, StoreReportResult} from './types.js'

export interface StoreReportInput {
  store: string
  analysis: string
  version?: string
  api?: StoreReportApi
}

interface StoreReportDependencies {
  prepareContext: typeof prepareAdminStoreGraphQLContext
  askAssistant: typeof askAssistant
  runShopifyqlQuery: typeof runShopifyqlReportQuery
  runAdminQuery: typeof runAdminReportQuery
}

const defaultStoreReportDependencies: StoreReportDependencies = {
  prepareContext: prepareAdminStoreGraphQLContext,
  askAssistant,
  runShopifyqlQuery: runShopifyqlReportQuery,
  runAdminQuery: runAdminReportQuery,
}

function executeParsedQuery(
  parsed: ParsedReportQuery,
  context: AdminStoreGraphQLContext,
  dependencies: StoreReportDependencies,
): Promise<ReportQueryOutcome<unknown>> {
  return parsed.api === 'shopifyql'
    ? dependencies.runShopifyqlQuery(context, parsed.query)
    : dependencies.runAdminQuery(context, parsed.query)
}

function forcedApiMismatch(forcedApi: StoreReportApi | undefined, parsed: ParsedReportQuery): boolean {
  return forcedApi !== undefined && parsed.api !== forcedApi
}

/**
 * The assistant has no structured-output guarantee, so it can reply with an `api` other than the
 * one `--api` locked it to. Since the two surfaces run completely different query languages,
 * silently executing whatever it returned could run the wrong one. Treat a mismatch as a failure
 * up front — without ever calling the query runner for either surface — so it flows through the
 * same retry path as a genuine query failure instead of executing.
 */
function executeHonoringForcedApi(
  parsed: ParsedReportQuery,
  context: AdminStoreGraphQLContext,
  dependencies: StoreReportDependencies,
  forcedApi: StoreReportApi | undefined,
): Promise<ReportQueryOutcome<unknown>> {
  if (forcedApiMismatch(forcedApi, parsed)) {
    return Promise.resolve({
      success: false,
      failure: {
        errorText: `You replied with "api": "${parsed.api}", but this run is locked to the "${forcedApi}" api. You must set "api" to "${forcedApi}" and write the query for that surface only.`,
        accessDenied: false,
        errors: undefined,
      },
    })
  }

  return executeParsedQuery(parsed, context, dependencies)
}

/**
 * Tries to pull the specific access scope named in an Admin `ACCESS_DENIED` error message (e.g.
 * "...requires the `read_orders` scope") so the re-auth hint is actionable. ShopifyQL's
 * requirement is fixed and already known, so it skips straight to that.
 */
function findRequiredScopeHint(api: StoreReportApi, errors: unknown): string {
  if (api === 'shopifyql') return 'read_reports'

  if (Array.isArray(errors)) {
    for (const entry of errors) {
      const message = (entry as {message?: unknown} | undefined)?.message
      if (typeof message !== 'string') continue
      const match = /`([a-z_]+)`\s+(?:access )?scope/i.exec(message)
      if (match?.[1]) return match[1]
    }
  }

  return '<comma-separated-scopes>'
}

function throwAccessDeniedError(store: string, api: StoreReportApi, failure: ReportQueryFailure): never {
  const scopeHint = findRequiredScopeHint(api, failure.errors)
  const apiLabel = api === 'shopifyql' ? 'ShopifyQL' : 'Admin GraphQL'

  throw new AbortError(
    `Stored app authentication for ${store} isn't authorized to run this ${apiLabel} query.`,
    undefined,
    [['Run', {command: `shopify store auth --store ${store} --scopes ${scopeHint}`}, 'to grant the required scope']],
  )
}

function throwExhaustedRetryError(parsed: ParsedReportQuery, failure: ReportQueryFailure): never {
  throw new AbortError(
    'The report query failed again after one retry.',
    `Last query (${parsed.api}):\n${parsed.query}\n\nError:\n${failure.errorText}`,
  )
}

function throwForcedApiNotHonoredError(forcedApi: StoreReportApi, parsed: ParsedReportQuery): never {
  throw new AbortError(
    `The assistant did not honor the required "${forcedApi}" api, even after a retry.`,
    `It replied with "api": "${parsed.api}" and query:\n${parsed.query}`,
  )
}

export async function runStoreReport(
  input: StoreReportInput,
  dependencies: Partial<StoreReportDependencies> = {},
): Promise<StoreReportResult> {
  const deps = {...defaultStoreReportDependencies, ...dependencies}

  await recordStoreFqdnMetadata(input.store, false)
  const context = await deps.prepareContext({store: input.store, userSpecifiedVersion: input.version})

  let parsed = parseAssistantReportResponse(
    await deps.askAssistant(buildReportPrompt({question: input.analysis, api: input.api})),
  )
  let outcome = await executeHonoringForcedApi(parsed, context, deps, input.api)

  if (!outcome.success) {
    if (outcome.failure.accessDenied) throwAccessDeniedError(input.store, parsed.api, outcome.failure)

    const failedQuery = parsed
    parsed = parseAssistantReportResponse(
      await deps.askAssistant(
        buildReportPrompt({
          question: input.analysis,
          api: input.api,
          retry: {failedApi: failedQuery.api, failedQuery: failedQuery.query, errorText: outcome.failure.errorText},
        }),
      ),
    )
    outcome = await executeHonoringForcedApi(parsed, context, deps, input.api)

    if (!outcome.success) {
      if (outcome.failure.accessDenied) throwAccessDeniedError(input.store, parsed.api, outcome.failure)
      if (forcedApiMismatch(input.api, parsed)) throwForcedApiNotHonoredError(input.api!, parsed)
      throwExhaustedRetryError(parsed, outcome.failure)
    }
  }

  return {
    store: context.adminSession.storeFqdn,
    apiVersion: context.version,
    question: input.analysis,
    api: parsed.api,
    query: parsed.query,
    rationale: parsed.rationale,
    result: outcome.result,
  }
}
