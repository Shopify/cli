import {ToolAnnotations} from './permissions.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {decodeToml} from '@shopify/cli-kit/node/toml'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StdioClientTransport, getDefaultEnvironment} from '@modelcontextprotocol/sdk/client/stdio.js'
import {homedir} from 'os'

export interface MCPServerConfig {
  command: string
  args?: string[]
  env?: {[key: string]: string}
}

export interface MCPToolDefinition {
  name: string
  description: string
  parameters: MCPToolParameter[]
  annotations?: ToolAnnotations
}

export interface MCPToolParameter {
  name: string
  type: string
  required: boolean
  description?: string
}

export interface MCPManagerOptions {
  configPath?: string
  workingDirectory?: string
}

interface MCPServerConnection {
  name: string
  config: MCPServerConfig
  tools: MCPToolDefinition[]
  client: Client
}

const SERVER_CONNECT_TIMEOUT_MS = 10_000

/**
 * MCPManager handles the lifecycle of MCP server processes.
 *
 * It spawns servers as child processes using stdio transport, performs the MCP
 * handshake, discovers tools, and routes tool execution calls.
 *
 * A bundled filesystem server is auto-registered when a workingDirectory is provided.
 *
 * Public API:
 * - constructor(options?: MCPManagerOptions) — configPath for TOML, workingDirectory for filesystem server
 * - initialize(): Promise<void> — spawns processes, performs handshake, discovers tools
 * - formatToolsAsXML(): string — generates XML tool descriptions for the LLM prompt
 * - executeToolCall(serverName, toolName, args): `Promise<Record<string, unknown>>` — executes a tool
 * - shutdown(): Promise<void> — closes all client connections and kills child processes
 */
export class MCPManager {
  private readonly servers = new Map<string, MCPServerConnection>()
  private readonly configPath: string
  private readonly workingDirectory: string | undefined

  constructor(options?: MCPManagerOptions) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
    this.configPath = options?.configPath ?? joinPath(home, '.config', 'shopify-sidekick', 'config.toml')
    this.workingDirectory = options?.workingDirectory
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

    // Auto-register bundled servers
    configs.set('shopify_dev', {command: 'npx', args: ['-y', '@shopify/dev-mcp@latest']})
    if (this.workingDirectory) {
      configs.set('filesystem', this.buildFilesystemServerConfig(this.workingDirectory))
    }

    // Connect all servers in parallel — individual failures don't block others
    const entries = Array.from(configs.entries())
    const results = await Promise.allSettled(entries.map(([name, config]) => this.connectServer(name, config)))

    for (const [index, result] of results.entries()) {
      const entry = entries[index]
      if (!entry) continue
      const [name] = entry
      if (result.status === 'rejected') {
        outputDebug(`Failed to connect MCP server "${name}": ${result.reason}`)
      }
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

  getToolAnnotations(serverName: string, toolName: string): ToolAnnotations | undefined {
    const server = this.servers.get(serverName)
    if (!server) return undefined
    const tool = server.tools.find((t) => t.name === toolName)
    return tool?.annotations
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
      const annotationParts: string[] = []
      if (tool.annotations) {
        if (tool.annotations.readOnlyHint !== undefined) {
          annotationParts.push(`readOnlyHint="${tool.annotations.readOnlyHint}"`)
        }
        if (tool.annotations.destructiveHint !== undefined) {
          annotationParts.push(`destructiveHint="${tool.annotations.destructiveHint}"`)
        }
      }
      const annotationsAttr = annotationParts.length > 0 ? ` ${annotationParts.join(' ')}` : ''
      return `  <tool name="${tool.name}" server="${serverName}">
    <description>${tool.description}</description>
    <parameters>
${params}
    </parameters>
    <annotations${annotationsAttr} />
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

    outputDebug(`Executing tool ${toolName} on server ${serverName} with args: ${JSON.stringify(args)}`)

    try {
      const result = await server.client.callTool({name: toolName, arguments: args})

      // Extract text content from the MCP result content array
      const contentArray = result.content as {type: string; text?: string}[] | undefined
      const textParts = (contentArray ?? [])
        .filter((content) => content.type === 'text' && content.text !== undefined)
        .map((content) => content.text as string)

      const output = textParts.join('\n')

      if (result.isError) {
        return {error: output || 'Tool execution failed'}
      }

      return {result: output}
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      outputDebug(`MCP tool execution error: ${message}`)
      return {error: `Tool execution failed: ${message}`}
    }
  }

  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.servers.entries()).map(async ([name, server]) => {
      try {
        await server.client.close()
        outputDebug(`Shut down MCP server: ${name}`)
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        outputDebug(`Error shutting down MCP server "${name}": ${message}`)
      }
    })

    await Promise.allSettled(shutdownPromises)
    this.servers.clear()
  }

  private buildFilesystemServerConfig(workingDirectory: string): MCPServerConfig {
    return {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', workingDirectory],
    }
  }

  private async connectServer(name: string, config: MCPServerConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: {...getDefaultEnvironment(), ...(config.env ?? {})},
      cwd: homedir(),
      stderr: 'pipe',
    })

    const client = new Client({name: 'sidekick-cli', version: '1.0.0'})

    // Connect with a timeout to avoid hanging on unresponsive servers
    await Promise.race([
      client.connect(transport),
      new Promise<never>((_resolve, reject) =>
        setTimeout(
          () => reject(new Error(`Connection to "${name}" timed out after ${SERVER_CONNECT_TIMEOUT_MS}ms`)),
          SERVER_CONNECT_TIMEOUT_MS,
        ),
      ),
    ])

    // Discover tools
    const {tools: mcpTools} = await client.listTools()
    const tools = mcpTools.map((tool) => this.convertToolDefinition(tool))

    this.servers.set(name, {name, config, tools, client})
    outputDebug(`Connected MCP server "${name}" with ${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`)
  }

  private convertToolDefinition(tool: {
    name: string
    description?: string
    inputSchema?: {properties?: {[key: string]: unknown}; required?: string[]}
    annotations?: {readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean}
  }): MCPToolDefinition {
    const properties = (tool.inputSchema?.properties ?? {}) as {
      [key: string]: {type?: string; description?: string}
    }
    const requiredSet = new Set(tool.inputSchema?.required ?? [])

    const parameters: MCPToolParameter[] = Object.entries(properties).map(([paramName, schema]) => ({
      name: paramName,
      type: schema.type ?? 'string',
      required: requiredSet.has(paramName),
      description: schema.description,
    }))

    return {
      name: tool.name,
      description: tool.description ?? '',
      parameters,
      annotations: tool.annotations,
    }
  }
}
