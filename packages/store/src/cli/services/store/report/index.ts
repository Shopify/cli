import {runReportAgent} from './agent.js'
import {prepareAdminStoreGraphQLContext, type AdminStoreGraphQLContext} from './execute.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {ReportProgress} from './progress.js'
import type {StoreReportResult} from './types.js'

export interface PrepareStoreReportInput {
  store: string
  version?: string
}

interface PrepareStoreReportDependencies {
  prepareContext: typeof prepareAdminStoreGraphQLContext
}

const defaultPrepareStoreReportDependencies: PrepareStoreReportDependencies = {
  prepareContext: prepareAdminStoreGraphQLContext,
}

const DEFAULT_PROXY_URL = 'https://proxy.shopify.ai/v1'
const DEFAULT_MODEL = 'gpt-5.1'

export interface ProxyConfig {
  proxyBaseUrl: string
  proxyToken: string
  model: string
}

/**
 * Reads the internal LLM proxy configuration from the environment. The token is required — without
 * it the agent can't reach a model — so a missing token fails fast with an actionable next step,
 * before any store authentication or network work happens.
 */
export function readProxyConfig(): ProxyConfig {
  const proxyToken = process.env.SHOPIFY_AI_PROXY_TOKEN
  if (!proxyToken) {
    throw new AbortError(
      'SHOPIFY_AI_PROXY_TOKEN is not set.',
      'Generate a token at https://proxy.shopify.io and set SHOPIFY_AI_PROXY_TOKEN before running shopify store report.',
    )
  }

  return {
    proxyBaseUrl: process.env.SHOPIFY_AI_PROXY_URL ?? DEFAULT_PROXY_URL,
    proxyToken,
    model: process.env.SHOPIFY_AI_PROXY_MODEL ?? DEFAULT_MODEL,
  }
}

export interface PreparedStoreReport {
  context: AdminStoreGraphQLContext
  proxyConfig: ProxyConfig
}

/**
 * Runs everything that must happen before the progress bar goes up: store attribution, reading the
 * proxy config, and preparing (and possibly prompting for) store auth. Any auth error or prompt this
 * surfaces needs to reach the user directly, not be hidden behind a spinner.
 */
export async function prepareStoreReport(
  input: PrepareStoreReportInput,
  dependencies: Partial<PrepareStoreReportDependencies> = {},
): Promise<PreparedStoreReport> {
  const deps = {...defaultPrepareStoreReportDependencies, ...dependencies}

  await recordStoreFqdnMetadata(input.store, false)
  const proxyConfig = readProxyConfig()
  const context = await deps.prepareContext({store: input.store, userSpecifiedVersion: input.version})

  return {context, proxyConfig}
}

export interface RunStoreReportInput {
  prepared: PreparedStoreReport
  analysis: string
  onProgress?: ReportProgress
}

interface RunStoreReportDependencies {
  runAgent: typeof runReportAgent
}

const defaultRunStoreReportDependencies: RunStoreReportDependencies = {
  runAgent: runReportAgent,
}

/** Runs the model phase — the agent loop — against an already-prepared store and shapes its result. */
export async function runStoreReport(
  input: RunStoreReportInput,
  dependencies: Partial<RunStoreReportDependencies> = {},
): Promise<StoreReportResult> {
  const deps = {...defaultRunStoreReportDependencies, ...dependencies}
  const {context, proxyConfig} = input.prepared

  const agentResult = await deps.runAgent({
    context,
    question: input.analysis,
    proxyBaseUrl: proxyConfig.proxyBaseUrl,
    proxyToken: proxyConfig.proxyToken,
    model: proxyConfig.model,
    onProgress: input.onProgress,
  })

  return {
    store: context.adminSession.storeFqdn,
    apiVersion: context.version,
    question: input.analysis,
    rationale: agentResult.summary,
    queries: agentResult.queries,
  }
}
