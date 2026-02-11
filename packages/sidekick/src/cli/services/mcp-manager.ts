import {readFile} from '@shopify/cli-kit/node/fs'
import {decodeToml} from '@shopify/cli-kit/node/toml'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'

export interface MCPServerConfig {
  command: string
  args?: string[]
  env?: {[key: string]: string}
}

export interface MCPToolDefinition {
  name: string
  description: string
  parameters: MCPToolParameter[]
  annotations?: {
    readOnlyHint?: boolean
    destructiveHint?: boolean
    idempotentHint?: boolean
    openWorldHint?: boolean
  }
}

export interface MCPToolParameter {
  name: string
  type: string
  required: boolean
  description?: string
}

interface MCPServerConnection {
  name: string
  config: MCPServerConfig
  tools: MCPToolDefinition[]
  process: null
}

export class MCPManager {
  private readonly servers = new Map<string, MCPServerConnection>()
  private readonly configPath: string

  constructor(configPath?: string) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
    this.configPath = configPath ?? joinPath(home, '.config', 'shopify-sidekick', 'config.toml')
  }

  async loadConfig(): Promise<Map<string, MCPServerConfig>> {
    const configs = new Map<string, MCPServerConfig>()
    try {
      const content = await readFile(this.configPath)
      const parsed = decodeToml(content) as {[key: string]: unknown}
      const mcpServers = (parsed.mcp_servers ?? {}) as {[key: string]: {[key: string]: unknown}}

      for (const [name, serverConfig] of Object.entries(mcpServers)) {
        configs.set(name, {
          command: serverConfig.command as string,
          args: (serverConfig.args as string[]) ?? [],
          env: (serverConfig.env as {[key: string]: string}) ?? {},
        })
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      outputDebug(`No MCP config found at ${this.configPath}`)
    }
    return configs
  }

  async initialize(): Promise<void> {
    const configs = await this.loadConfig()
    for (const [name, config] of configs) {
      this.servers.set(name, {
        name,
        config,
        tools: [],
        process: null,
      })
      outputDebug(`Registered MCP server: ${name}`)
    }
  }

  getAvailableTools(): {serverName: string; tool: MCPToolDefinition}[] {
    const tools: {serverName: string; tool: MCPToolDefinition}[] = []
    for (const [serverName, server] of this.servers) {
      for (const tool of server.tools) {
        tools.push({serverName, tool})
      }
    }
    return tools
  }

  formatToolsAsXML(): string {
    const tools = this.getAvailableTools()
    if (tools.length === 0) return ''

    const toolElements = tools.map(({serverName, tool}) => {
      const params = tool.parameters
        .map(
          (param) =>
            `      <param name="${param.name}" type="${param.type}" required="${param.required}">${
              param.description ?? ''
            }</param>`,
        )
        .join('\n')
      const annotations = tool.annotations ? ` readOnlyHint="${tool.annotations.readOnlyHint ?? false}"` : ''
      return `  <tool name="${tool.name}" server="${serverName}">
    <description>${tool.description}</description>
    <parameters>
${params}
    </parameters>
    <annotations${annotations} />
  </tool>`
    })

    return `<available_mcp_tools>\n${toolElements.join('\n')}\n</available_mcp_tools>`
  }

  async executeToolCall(
    serverName: string,
    toolName: string,
    args: {[key: string]: unknown},
  ): Promise<{[key: string]: unknown}> {
    const server = this.servers.get(serverName)
    if (!server) {
      return {error: `MCP server "${serverName}" not found`}
    }

    // Placeholder for actual MCP protocol execution
    // In a full implementation, this would communicate with the MCP server process
    // via JSON-RPC over stdio
    outputDebug(`Executing tool ${toolName} on server ${serverName} with args: ${JSON.stringify(args)}`)
    return {error: 'MCP tool execution not yet implemented'}
  }

  async shutdown(): Promise<void> {
    for (const [name] of this.servers) {
      // Future: Implement actual MCP server process management
      outputDebug(`Shut down MCP server: ${name}`)
    }
    this.servers.clear()
  }
}
