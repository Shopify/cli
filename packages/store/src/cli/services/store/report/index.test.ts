import {runStoreReport} from './index.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import type {AdminStoreGraphQLContext} from './execute.js'
import type {ReportAgentResult} from './agent.js'

vi.mock('../attribution.js')

describe('runStoreReport', () => {
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

  const prepareContext = vi.fn().mockResolvedValue(context)
  const runAgent = vi.fn()
  const dependencies = {prepareContext, runAgent}

  beforeEach(() => {
    // A token is required; url and model fall back to defaults unless a test overrides them.
    vi.stubEnv('SHOPIFY_AI_PROXY_TOKEN', 'test-token')
    vi.stubEnv('SHOPIFY_AI_PROXY_URL', undefined)
    vi.stubEnv('SHOPIFY_AI_PROXY_MODEL', undefined)
    prepareContext.mockClear().mockResolvedValue(context)
    runAgent.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('assembles the report envelope from the agent result', async () => {
    const agentResult: ReportAgentResult = {
      queries: [{api: 'shopifyql', query: 'FROM sales SHOW total_sales SINCE -30d', result: {columns: [], rows: []}}],
      summary: 'Your total sales over the last 30 days were $100.',
    }
    runAgent.mockResolvedValue(agentResult)

    const result = await runStoreReport(
      {store: 'shop.myshopify.com', analysis: 'What were my sales in the last 30 days?'},
      dependencies,
    )

    expect(result).toEqual({
      store: 'shop.myshopify.com',
      apiVersion: '2025-10',
      question: 'What were my sales in the last 30 days?',
      rationale: 'Your total sales over the last 30 days were $100.',
      queries: agentResult.queries,
    })
    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith('shop.myshopify.com', false)
    expect(prepareContext).toHaveBeenCalledWith({store: 'shop.myshopify.com', userSpecifiedVersion: undefined})
  })

  test('passes the store context, question, and proxy defaults to the agent', async () => {
    runAgent.mockResolvedValue({
      queries: [{api: 'admin', query: '{ shop { name } }', result: {}}],
      summary: 'ok',
    })

    await runStoreReport(
      {store: 'shop.myshopify.com', analysis: 'What is my shop name?', version: '2025-07'},
      dependencies,
    )

    expect(prepareContext).toHaveBeenCalledWith({store: 'shop.myshopify.com', userSpecifiedVersion: '2025-07'})
    expect(runAgent).toHaveBeenCalledWith({
      context,
      question: 'What is my shop name?',
      proxyBaseUrl: 'https://proxy.shopify.ai/v1',
      proxyToken: 'test-token',
      model: 'gpt-5.1',
    })
  })

  test('reads a custom proxy url and model from the environment', async () => {
    vi.stubEnv('SHOPIFY_AI_PROXY_URL', 'https://custom.proxy/v2')
    vi.stubEnv('SHOPIFY_AI_PROXY_MODEL', 'gpt-custom')
    runAgent.mockResolvedValue({
      queries: [{api: 'shopifyql', query: 'FROM sales SHOW orders', result: {}}],
      summary: 's',
    })

    await runStoreReport({store: 'shop.myshopify.com', analysis: 'How many orders?'}, dependencies)

    expect(runAgent).toHaveBeenCalledWith(
      expect.objectContaining({proxyBaseUrl: 'https://custom.proxy/v2', model: 'gpt-custom'}),
    )
  })

  test('throws an actionable AbortError when SHOPIFY_AI_PROXY_TOKEN is not set, before any store work', async () => {
    vi.stubEnv('SHOPIFY_AI_PROXY_TOKEN', undefined)

    await expect(
      runStoreReport({store: 'shop.myshopify.com', analysis: 'What were my sales?'}, dependencies),
    ).rejects.toMatchObject({
      message: 'SHOPIFY_AI_PROXY_TOKEN is not set.',
      tryMessage: expect.stringContaining('proxy.shopify.io'),
    })

    expect(prepareContext).not.toHaveBeenCalled()
    expect(runAgent).not.toHaveBeenCalled()
  })
})
