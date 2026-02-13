import {execShopify, formatToolResult} from '../subprocess.js'
import {z} from 'zod'
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import type {McpServerConfig} from '../config.js'

const MCP_TIPS = `
## MCP Usage Tips

- --no-color is always appended automatically by this server
- Use --json flag when available for structured, parseable output
- Use --force or -f to skip confirmation prompts (required for non-interactive use)
- Store is injected from server config via SHOPIFY_FLAG_STORE if configured
- Theme Access token is injected via SHOPIFY_CLI_THEME_TOKEN if configured
- For theme push/pull: use --only and --ignore to filter files
- theme dev and app dev are long-running processes — start them in a separate terminal, not through this server
- Use the shopify_auth_login tool if you encounter authentication errors`.trim()

export function registerCliHelp(server: McpServer, config: McpServerConfig): void {
  server.registerTool(
    'shopify_cli_help',
    {
      description:
        'Get help for any Shopify CLI command. Returns usage info, available flags, and MCP-specific tips. Call with no command to see all available commands.',
      inputSchema: {
        command: z
          .string()
          .optional()
          .describe(
            'CLI command to get help for (e.g. "theme push", "theme", "app deploy", "auth"). Omit to see all top-level commands.',
          ),
      },
    },
    async (params) => {
      const args = params.command ? params.command.split(/\s+/) : []
      args.push('--help')

      const result = await execShopify(config, args)
      const formatted = formatToolResult(result)
      const helpText = formatted.content[0]?.text ?? ''

      return {content: [{type: 'text', text: `${helpText}\n\n${MCP_TIPS}`}], isError: formatted.isError}
    },
  )
}
