import {prepareStoreReport, runStoreReport, type PreparedStoreReport} from './index.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import type {AdminStoreGraphQLContext} from './execute.js'
import type {ReportAgentResult} from './agent.js'

vi.mock('../attribution.js')

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

describe('prepareStoreReport', () => {
  const prepareContext = vi.fn().mockResolvedValue(context)
  const dependencies = {prepareContext}

  beforeEach(() => {
    vi.stubEnv('SHOPIFY_AI_PROXY_TOKEN', 'test-token')
    vi.stubEnv('SHOPIFY_AI_PROXY_URL', undefined)
    vi.stubEnv('SHOPIFY_AI_PROXY_MODEL', undefined)
    prepareContext.mockClear().mockResolvedValue(context)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('records store attribution and returns the prepared context and proxy config', async () => {
    const prepared = await prepareStoreReport({store: 'shop.myshopify.com'}, dependencies)

    expect(prepared).toEqual({
      context,
      proxyConfig: {proxyBaseUrl: 'https://proxy.shopify.ai/v1', proxyToken: 'test-token', model: 'gpt-5.1'},
    })
    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith('shop.myshopify.com', false)
    expect(prepareContext).toHaveBeenCalledWith({store: 'shop.myshopify.com', userSpecifiedVersion: undefined})
  })

  test('passes the user-specified version through to prepareContext', async () => {
    await prepareStoreReport({store: 'shop.myshopify.com', version: '2025-07'}, dependencies)

    expect(prepareContext).toHaveBeenCalledWith({store: 'shop.myshopify.com', userSpecifiedVersion: '2025-07'})
  })

  test('reads a custom proxy url and model from the environment', async () => {
    vi.stubEnv('SHOPIFY_AI_PROXY_URL', 'https://custom.proxy/v2')
    vi.stubEnv('SHOPIFY_AI_PROXY_MODEL', 'gpt-custom')

    const prepared = await prepareStoreReport({store: 'shop.myshopify.com'}, dependencies)

    expect(prepared.proxyConfig).toEqual({
      proxyBaseUrl: 'https://custom.proxy/v2',
      proxyToken: 'test-token',
      model: 'gpt-custom',
    })
  })

  test('throws an actionable AbortError when SHOPIFY_AI_PROXY_TOKEN is not set, before preparing store auth', async () => {
    vi.stubEnv('SHOPIFY_AI_PROXY_TOKEN', undefined)

    await expect(prepareStoreReport({store: 'shop.myshopify.com'}, dependencies)).rejects.toMatchObject({
      message: 'SHOPIFY_AI_PROXY_TOKEN is not set.',
      tryMessage: expect.stringContaining('proxy.shopify.io'),
    })

    expect(prepareContext).not.toHaveBeenCalled()
  })
})

describe('runStoreReport', () => {
  const prepared: PreparedStoreReport = {
    context,
    proxyConfig: {proxyBaseUrl: 'https://proxy.shopify.ai/v1', proxyToken: 'test-token', model: 'gpt-5.1'},
  }

  const runAgent = vi.fn()
  const dependencies = {runAgent}

  beforeEach(() => {
    runAgent.mockReset()
  })

  test('assembles the report envelope from the agent result', async () => {
    const agentResult: ReportAgentResult = {
      queries: [{api: 'shopifyql', query: 'FROM sales SHOW total_sales SINCE -30d', result: {columns: [], rows: []}}],
      summary: 'Your total sales over the last 30 days were $100.',
    }
    runAgent.mockResolvedValue(agentResult)

    const result = await runStoreReport({prepared, analysis: 'What were my sales in the last 30 days?'}, dependencies)

    expect(result).toEqual({
      store: 'shop.myshopify.com',
      apiVersion: '2025-10',
      question: 'What were my sales in the last 30 days?',
      rationale: 'Your total sales over the last 30 days were $100.',
      queries: agentResult.queries,
    })
  })

  test('passes the prepared context, question, proxy config, and onProgress to the agent', async () => {
    runAgent.mockResolvedValue({queries: [{api: 'admin', query: '{ shop { name } }', result: {}}], summary: 'ok'})
    const onProgress = vi.fn()

    await runStoreReport({prepared, analysis: 'What is my shop name?', onProgress}, dependencies)

    expect(runAgent).toHaveBeenCalledWith({
      context,
      question: 'What is my shop name?',
      proxyBaseUrl: 'https://proxy.shopify.ai/v1',
      proxyToken: 'test-token',
      model: 'gpt-5.1',
      onProgress,
    })
  })
})
