import {execShopify, formatToolResult, isLongRunningCommand} from '../subprocess.js'
import {z} from 'zod'
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import type {McpServerConfig} from '../config.js'

export function registerCliRun(server: McpServer, config: McpServerConfig): void {
  server.registerTool(
    'shopify_cli_run',
    {
      description:
        'Run any Shopify CLI command. Automatically appends --no-color and injects store/auth from server config. Use shopify_cli_help to discover available commands and flags.',
      inputSchema: {
        command: z
          .string()
          .describe(
            'The CLI command to run after "shopify" (e.g. "theme list --json", "theme push --force --json", "theme check --output json")',
          ),
      },
    },
    async (params) => {
      const args = params.command.split(/\s+/).filter(Boolean)

      const longRunning = isLongRunningCommand(args)
      if (longRunning) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `"shopify ${longRunning}" is a long-running dev server process that streams output continuously. Start it in a separate terminal instead:\n\nshopify ${longRunning}${
                config.store ? ` --store ${config.store}` : ''
              }`,
            },
          ],
        }
      }

      const result = await execShopify(config, args)
      return formatToolResult(result)
    },
  )
}
