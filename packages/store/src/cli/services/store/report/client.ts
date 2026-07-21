import {OpenAIProvider, Runner, setTracingDisabled} from '@openai/agents'
import {OpenAI} from 'openai'

export interface ProxyRunnerInput {
  proxyBaseUrl: string
  proxyToken: string
}

/** Creates an Agents SDK runner configured for Shopify's Chat Completions proxy. */
export function createProxyRunner({proxyBaseUrl, proxyToken}: ProxyRunnerInput): Runner {
  // Tracing is a process-global in the SDK: the `Runner`'s `tracingDisabled` only skips per-run
  // trace creation, but the global exporter still POSTs traces to api.openai.com using our proxy
  // token as if it were an OpenAI API key (a noisy 401 that also echoes the token). Every proxy
  // model path shares this factory so the global exporter cannot accidentally be left enabled.
  setTracingDisabled(true)

  const openAIClient = new OpenAI({baseURL: proxyBaseUrl, apiKey: proxyToken})
  const modelProvider = new OpenAIProvider({openAIClient, useResponses: false})
  return new Runner({modelProvider, tracingDisabled: true})
}
