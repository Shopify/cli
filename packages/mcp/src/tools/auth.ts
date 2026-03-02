import type {SessionManager} from '../session-manager.js'
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {z} from 'zod'

export interface ToolResult {
  [key: string]: unknown
  content: Array<{type: 'text'; text: string}>
  isError?: boolean
}

export function resolveStore(store: string | undefined): string | undefined {
  return store ?? process.env.SHOPIFY_FLAG_STORE
}

export async function handleAuthLogin(sessionManager: SessionManager, store: string | undefined): Promise<ToolResult> {
  const resolvedStore = resolveStore(store)
  if (!resolvedStore) {
    return {
      content: [{type: 'text', text: 'Error: No store specified. Provide a store parameter or set SHOPIFY_FLAG_STORE environment variable.'}],
      isError: true,
    }
  }

  try {
    const existing = await sessionManager.getSession(resolvedStore)
    if (existing) {
      return {
        content: [{type: 'text', text: `Already authenticated with store ${existing.storeFqdn}.`}],
      }
    }

    const deviceCode = await sessionManager.startAuth(resolvedStore)
    return {
      content: [
        {
          type: 'text',
          text: [
            'To authenticate, open this URL in your browser:',
            '',
            deviceCode.verificationUriComplete,
            '',
            `User code: ${deviceCode.userCode}`,
            '',
            'After approving in the browser, try your next request -- authentication will complete automatically.',
          ].join('\n'),
        },
      ],
    }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error)
    const message = rawMessage.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/\/Users\/[^\s]+/g, '[PATH]')
    return {
      content: [{type: 'text', text: `Authentication error: ${message}`}],
      isError: true,
    }
  }
}

export function registerAuthTool(server: McpServer, sessionManager: SessionManager) {
  server.tool(
    'shopify_auth_login',
    'Authenticate with a Shopify store. Returns a URL the user must visit to complete login. After approval, subsequent shopify_graphql calls will automatically use the session.',
    {
      store: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9\-.]*$/).optional().describe('Store domain (e.g. "my-store.myshopify.com"). Must match /^[a-zA-Z0-9][a-zA-Z0-9\\-.]*$/. Defaults to SHOPIFY_FLAG_STORE env var.'),
    },
    ({store}) => handleAuthLogin(sessionManager, store),
  )
}
