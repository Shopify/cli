import {execShopify, formatToolResult} from '../subprocess.js'
import {z} from 'zod'
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import type {McpServerConfig} from '../config.js'

export function registerAuthLogin(server: McpServer, config: McpServerConfig): void {
  server.registerTool(
    'shopify_auth_login',
    {
      description:
        'Log in to your Shopify account. Opens the browser for OAuth authentication. Use this when other commands fail with authentication errors.',
      inputSchema: {
        store: z.string().optional().describe('Store URL to associate with the login'),
      },
    },
    async (params) => {
      const args = ['auth', 'login']
      const store = params.store ?? config.store
      if (store) args.push('--store', store)

      const result = await execShopify(config, args, {timeout: 120_000})
      return formatToolResult(result)
    },
  )
}
