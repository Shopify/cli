import {callFlowTool} from './tool-call.js'
import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {ensureAuthenticatedIdentity} from '@shopify/cli-kit/node/session'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/http')

describe('flow tool call service', () => {
  const originalServiceEnv = process.env.SHOPIFY_SERVICE_ENV
  const originalEndpoint = process.env.SHOPIFY_FLOW_TOOL_CALL_ENDPOINT

  beforeEach(() => {
    delete process.env.SHOPIFY_SERVICE_ENV
    delete process.env.SHOPIFY_FLOW_TOOL_CALL_ENDPOINT
    vi.clearAllMocks()
    vi.mocked(ensureAuthenticatedIdentity).mockResolvedValue({token: 'identity-token', userId: 'user-id'})
    vi.mocked(shopifyFetch).mockResolvedValue(
      new Response(JSON.stringify({isError: false, content: []}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
    )
  })

  afterEach(() => {
    if (originalServiceEnv === undefined) {
      delete process.env.SHOPIFY_SERVICE_ENV
    } else {
      process.env.SHOPIFY_SERVICE_ENV = originalServiceEnv
    }

    if (originalEndpoint === undefined) {
      delete process.env.SHOPIFY_FLOW_TOOL_CALL_ENDPOINT
    } else {
      process.env.SHOPIFY_FLOW_TOOL_CALL_ENDPOINT = originalEndpoint
    }
  })

  test('authenticates with the CLI identity session and calls the explicit endpoint', async () => {
    const result = await callFlowTool({
      tool: 'flow_app_agent_template_search',
      store: 'shop.myshopify.com',
      arguments: '{"search_queries":["fraud prevention"]}',
      endpoint: 'https://sidekick.example/flow/tools/call',
    })

    expect(ensureAuthenticatedIdentity).toHaveBeenCalledWith(['https://api.shopify.com/auth/flow.workflows.manage'])
    expect(shopifyFetch).toHaveBeenCalledWith(
      'https://sidekick.example/flow/tools/call',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer identity-token',
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': 'shop.myshopify.com',
          'X-Shopify-User-Id': 'user-id',
        },
        body: JSON.stringify({
          tool: 'flow_app_agent_template_search',
          arguments: {search_queries: ['fraud prevention']},
        }),
      }),
      'slow-request',
    )
    expect(result).toEqual({isError: false, content: []})
  })

  test('routes Flow-owned tools directly to local Flow in local development', async () => {
    process.env.SHOPIFY_SERVICE_ENV = 'local'

    await callFlowTool({
      tool: 'flow_app_agent_template_search',
      store: 'shop1.my.shop.dev',
      arguments: '{"search_queries":["fraud prevention"]}',
    })

    expect(shopifyFetch).toHaveBeenCalledWith(
      'https://flow.shop.dev/flow-core/tool_call',
      expect.anything(),
      'slow-request',
    )
  })

  test('routes SK-native tools to local agent-server in local development', async () => {
    process.env.SHOPIFY_SERVICE_ENV = 'local'

    await callFlowTool({
      tool: 'flow_app_agent_search_shop_resource',
      store: 'shop1.my.shop.dev',
      arguments: '{"query":"products"}',
    })

    expect(shopifyFetch).toHaveBeenCalledWith(
      'https://agent-server.shop.dev/flow/tools/call',
      expect.anything(),
      'slow-request',
    )
  })

  test('requests Admin GraphQL scope for SK-native tools', async () => {
    await callFlowTool({
      tool: 'flow_app_agent_search_shop_resource',
      store: 'shop.myshopify.com',
      arguments: '{"resource_type":"PRODUCT","query":"shirt"}',
    })

    expect(ensureAuthenticatedIdentity).toHaveBeenCalledWith(['https://api.shopify.com/auth/shop.admin.graphql'])
    expect(shopifyFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer identity-token',
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': 'shop.myshopify.com',
          'X-Shopify-User-Id': 'user-id',
        },
      }),
      'slow-request',
    )
  })

  test('rejects non-object arguments json', async () => {
    await expect(
      callFlowTool({
        tool: 'flow_app_agent_template_search',
        store: 'shop.myshopify.com',
        arguments: '[]',
      }),
    ).rejects.toThrow('Flow tool arguments must be a JSON object.')
  })

  test('raises a useful error for gateway failures', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(
      new Response(JSON.stringify({error: 'not allowed'}), {
        status: 403,
        statusText: 'Forbidden',
        headers: {'Content-Type': 'application/json'},
      }),
    )

    await expect(
      callFlowTool({
        tool: 'flow_app_agent_template_search',
        store: 'shop.myshopify.com',
        arguments: '{"search_queries":["fraud prevention"]}',
      }),
    ).rejects.toThrow('Flow tool gateway request failed with HTTP 403.')
  })
})
