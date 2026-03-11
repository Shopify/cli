import type {SessionManager} from '../session-manager.js'
import type {ToolResult} from './auth.js'
import {resolveStore} from './auth.js'
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {z} from 'zod'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'

const MUTATION_PATTERN = /(?:^|\n)\s*mutation[\s({]/i

export async function handleGraphql(
  sessionManager: SessionManager,
  params: {query: string; variables?: Record<string, unknown>; store?: string; allowMutations: boolean},
): Promise<ToolResult> {
  console.error('[tool_call] shopify_graphql store=%s mutation=%s', params.store, MUTATION_PATTERN.test(params.query.replace(/#[^\n]*/g, '')))
  const resolvedStore = resolveStore(params.store)
  if (!resolvedStore) {
    return {
      content: [{type: 'text', text: 'Error: No store specified. Provide a store parameter or set SHOPIFY_FLAG_STORE environment variable.'}],
      isError: true,
    }
  }

  const stripped = params.query.replace(/#[^\n]*/g, '')
  if (MUTATION_PATTERN.test(stripped) && !params.allowMutations) {
    return {
      content: [{type: 'text', text: 'Error: Mutations require allowMutations: true. This is a safety measure to prevent unintended changes.'}],
      isError: true,
    }
  }

  try {
    const session = await sessionManager.requireSession(resolvedStore)
    const result = await adminRequest<unknown>(params.query, session, params.variables)
    return {
      content: [{type: 'text', text: JSON.stringify(result, null, 2)}],
    }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error)
    const message = rawMessage.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/\/Users\/[^\s]+/g, '[PATH]')
    const isAuthError = message.includes('Not authenticated') || message.includes('shopify_auth_login')

    if (isAuthError) {
      return {content: [{type: 'text', text: message}], isError: true}
    }

    const isExpiredToken = message.includes('401') || message.includes('Unauthorized')
    if (isExpiredToken) {
      sessionManager.clearSession(resolvedStore)
      return {
        content: [{type: 'text', text: 'Session expired. Call shopify_auth_login to re-authenticate.'}],
        isError: true,
      }
    }

    return {content: [{type: 'text', text: `GraphQL error: ${message}`}], isError: true}
  }
}

export function registerGraphqlTool(server: McpServer, sessionManager: SessionManager) {
  server.tool(
    'shopify_graphql',
    'Execute a GraphQL query or mutation against the Shopify Admin API. Requires authentication via shopify_auth_login first. Uses the latest supported API version. Set allowMutations: true to run mutations.',
    {
      query: z.string().describe('GraphQL query or mutation string'),
      variables: z.record(z.unknown()).optional().describe('GraphQL variables'),
      store: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9\-.]*$/).optional().describe('Store domain override. Must match /^[a-zA-Z0-9][a-zA-Z0-9\\-.]*$/. Defaults to SHOPIFY_FLAG_STORE env var.'),
      allowMutations: z.boolean().optional().default(false).describe('Must be true to execute mutations'),
    },
    ({query, variables, store, allowMutations}) => handleGraphql(sessionManager, {query, variables, store, allowMutations}),
  )
}
