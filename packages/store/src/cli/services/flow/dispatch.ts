/*
 * Transport primitive for Flow + SK tool calls.
 *
 * Each first-class CLI command (e.g. `flow template search`,
 * `flow workflow push`) constructs the structured args it needs and calls
 * `dispatchFlowTool` to send the request. This file owns:
 *   - Routing (Flow vs SK endpoint, prod vs local)
 *   - Auth (Identity scope per source)
 *   - Headers (shop domain, user id, eval flag)
 *   - Response parsing + error envelope
 *
 * No tool catalog, no name lookup, no zod here. Callers know what they want
 * to call; this just dispatches it.
 */
import {AbortError} from '@shopify/cli-kit/node/error'
import {shopifyFetch, type Response} from '@shopify/cli-kit/node/http'
import {ensureAuthenticatedIdentity} from '@shopify/cli-kit/node/session'

const FLOW_TOOL_CALL_BASE_PRODUCTION = 'https://flow.shopifycloud.com/flow-core/tool_call'
const FLOW_TOOL_CALL_BASE_LOCAL = 'https://flow.shop.dev/flow-core/tool_call'
const SK_TOOL_CALL_BASE_PRODUCTION = 'https://sidekick.shopify.ai/tools/call'
const SK_TOOL_CALL_BASE_LOCAL = 'https://agent-server.shop.dev/tools/call'

const FLOW_WORKFLOWS_MANAGE_SCOPE = 'https://api.shopify.com/auth/flow.workflows.manage'
const SHOP_ADMIN_GRAPHQL_SCOPE = 'https://api.shopify.com/auth/shop.admin.graphql'

export type ToolSource = 'flow' | 'sk'

export interface DispatchInput {
  name: string
  source: ToolSource
  store: string
  args: Record<string, unknown>
  isEval?: boolean
}

function isLocalEnvironment(): boolean {
  return process.env.SHOPIFY_SERVICE_ENV === 'local'
}

export function endpointFor(source: ToolSource): string {
  const local = isLocalEnvironment()
  if (source === 'flow') return local ? FLOW_TOOL_CALL_BASE_LOCAL : FLOW_TOOL_CALL_BASE_PRODUCTION
  return local ? SK_TOOL_CALL_BASE_LOCAL : SK_TOOL_CALL_BASE_PRODUCTION
}

export function scopeFor(source: ToolSource): string {
  return source === 'flow' ? FLOW_WORKFLOWS_MANAGE_SCOPE : SHOP_ADMIN_GRAPHQL_SCOPE
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {raw: text}
  }
}

export async function dispatchFlowTool(input: DispatchInput): Promise<unknown> {
  const auth = await ensureAuthenticatedIdentity([scopeFor(input.source)])
  const endpoint = endpointFor(input.source)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.token}`,
    'Content-Type': 'application/json',
    'X-Shopify-Shop-Domain': input.store,
    'X-Shopify-User-Id': auth.userId,
  }
  if (input.isEval) headers['X-Shopify-Is-Eval'] = 'true'

  const response = await shopifyFetch(
    endpoint,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tool: input.name,
        arguments: input.args,
      }),
    },
    'slow-request',
  )

  const body = await parseResponse(response)

  if (!response.ok) {
    const verbose = process.env.DEBUG && process.env.DEBUG !== ''
    const display = verbose ? body : stripBacktraces(body)
    const hint = verbose ? undefined : 'Re-run with --verbose to see full backtraces.'
    throw new AbortError(
      `Flow tool gateway request failed with HTTP ${response.status}.`,
      [JSON.stringify(display, null, 2), hint].filter(Boolean).join('\n\n'),
    )
  }

  return body
}

function stripBacktraces(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripBacktraces)
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'error_backtrace')
      .map(([key, val]) => [key, stripBacktraces(val)] as const)
    return Object.fromEntries(entries)
  }
  return value
}

export interface ToolJsonResponse<T> {
  ok: boolean
  tool?: string
  data?: T
}

export function unwrapJsonResult<T>(response: unknown): T {
  const typed = response as ToolJsonResponse<T> | undefined
  if (!typed?.data) throw new AbortError('Flow tool returned an unexpected response shape.')
  return typed.data
}
