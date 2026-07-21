import {runReportAgent} from './agent.js'
import {prepareAdminStoreGraphQLContext} from './execute.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {StoreReportResult} from './types.js'

export interface StoreReportInput {
  store: string
  analysis: string
  version?: string
}

interface StoreReportDependencies {
  prepareContext: typeof prepareAdminStoreGraphQLContext
  runAgent: typeof runReportAgent
}

const defaultStoreReportDependencies: StoreReportDependencies = {
  prepareContext: prepareAdminStoreGraphQLContext,
  runAgent: runReportAgent,
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

export async function runStoreReport(
  input: StoreReportInput,
  dependencies: Partial<StoreReportDependencies> = {},
): Promise<StoreReportResult> {
  const deps = {...defaultStoreReportDependencies, ...dependencies}

  await recordStoreFqdnMetadata(input.store, false)
  const {proxyBaseUrl, proxyToken, model} = readProxyConfig()
  const context = await deps.prepareContext({store: input.store, userSpecifiedVersion: input.version})

  const agentResult = await deps.runAgent({
    context,
    question: input.analysis,
    proxyBaseUrl,
    proxyToken,
    model,
  })

  return {
    store: context.adminSession.storeFqdn,
    apiVersion: context.version,
    question: input.analysis,
    api: agentResult.api,
    query: agentResult.query,
    rationale: agentResult.summary,
    result: agentResult.result,
  }
}
