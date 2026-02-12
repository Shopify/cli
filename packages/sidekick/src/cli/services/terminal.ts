import {SidekickClient, SSEEvent, ClientToolCall, ToolCallResult} from './sidekick-client.js'
import {MCPManager} from './mcp-manager.js'
import {createOutputHandler, OutputFormat} from './output.js'
import {checkToolPermission, checkShellPermission, PermissionOptions, ToolCallRequest} from './permissions.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

const MAX_TOOL_CALL_ITERATIONS = 20

export interface TerminalSessionOptions {
  apiEndpoint: string
  token: string
  storeHandle: string
  format: OutputFormat
  yolo: boolean
  interactive: boolean
  stdinContent?: string
}

export class TerminalSession {
  private readonly client: SidekickClient
  private readonly mcpManager: MCPManager
  private readonly format: OutputFormat
  private readonly permissionOptions: PermissionOptions
  private readonly stdinContent: string | undefined

  constructor(options: TerminalSessionOptions) {
    this.client = new SidekickClient({
      apiEndpoint: options.apiEndpoint,
      token: options.token,
      storeHandle: options.storeHandle,
    })
    this.mcpManager = new MCPManager()
    this.format = options.format
    this.permissionOptions = {
      yolo: options.yolo,
      interactive: options.interactive,
    }
    this.stdinContent = options.stdinContent
  }

  async initialize(): Promise<void> {
    await this.mcpManager.initialize()
  }

  async oneShot(prompt: string): Promise<void> {
    const fullPrompt = this.buildPrompt(prompt)
    await this.sendAndProcess(fullPrompt)
  }

  async interactive(): Promise<void> {
    await this.initialize()

    let running = true
    while (running) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const prompt = await renderTextPrompt({
          message: 'sidekick>',
          allowEmpty: false,
        })

        if (prompt.toLowerCase() === 'exit' || prompt.toLowerCase() === 'quit') {
          running = false
          break
        }

        // eslint-disable-next-line no-await-in-loop
        await this.sendAndProcess(this.buildPrompt(prompt))
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        // User cancelled (Ctrl+C)
        running = false
      }
    }
  }

  shutdown(): void {
    this.client.abort()
    this.mcpManager.shutdown().catch(() => {
      // Ignore shutdown errors
    })
  }

  private buildPrompt(prompt: string): string {
    const cliContext = [
      '<cli_context>',
      'You are running inside the Shopify CLI terminal, not the admin web UI.',
      'The user is a developer interacting with you from their local machine.',
      'You have access to execute_shell_command to run commands on their system.',
      'Use it when asked to perform local operations like listing files, running scripts, or inspecting the environment.',
      '</cli_context>',
    ].join('\n')

    let fullPrompt = `${cliContext}\n\n${prompt}`
    if (this.stdinContent) {
      fullPrompt = `${fullPrompt}\n\n<user_provided_data>\n${this.stdinContent}\n</user_provided_data>`
    }

    const toolsXML = this.mcpManager.formatToolsAsXML()
    if (toolsXML) {
      fullPrompt = `${fullPrompt}\n\n${toolsXML}`
    }

    return fullPrompt
  }

  private async sendAndProcess(prompt: string): Promise<void> {
    const outputHandler = createOutputHandler(this.format)
    let pendingToolCalls: ClientToolCall[] = []
    let iterationCount = 0

    const handleEvent = async (event: SSEEvent): Promise<void> => {
      switch (event.type) {
        case 'message': {
          outputHandler.onChunk(event.data)
          break
        }
        case 'client_tool_call': {
          try {
            const toolCall = JSON.parse(event.data) as ClientToolCall
            pendingToolCalls.push(toolCall)
            // eslint-disable-next-line no-catch-all/no-catch-all
          } catch {
            outputDebug(`Failed to parse tool call: ${event.data}`)
          }
          break
        }
        case 'conversation_title': {
          try {
            const parsed = JSON.parse(event.data) as {conversation_id: string; conversation_title: string}
            this.client.setConversationId(parsed.conversation_id)
            // eslint-disable-next-line no-catch-all/no-catch-all
          } catch {
            outputDebug(`Failed to parse conversation_title: ${event.data}`)
          }
          break
        }
        case 'end': {
          break
        }
        case 'error':
        case 'server_error':
        case 'llm_error':
        case 'llm_content_error': {
          const errorMsg = event.data
          outputDebug(`Sidekick error (${event.type}): ${errorMsg}`)
          process.stderr.write(`Error: ${errorMsg}\n`)
          break
        }
        default:
          break
      }
    }

    await this.client.sendMessage(prompt, handleEvent)

    // Process any pending tool calls
    while (pendingToolCalls.length > 0) {
      iterationCount++
      if (iterationCount > MAX_TOOL_CALL_ITERATIONS) {
        outputDebug(
          `Exceeded maximum tool call iterations (${MAX_TOOL_CALL_ITERATIONS}). Stopping to prevent infinite loop.`,
        )
        break
      }

      const toolCalls = [...pendingToolCalls]
      pendingToolCalls = []
      // eslint-disable-next-line no-await-in-loop
      const results = await this.processToolCalls(toolCalls)

      if (results.length > 0) {
        // Send results back and continue processing
        // eslint-disable-next-line no-await-in-loop
        await this.client.sendToolResults(results, handleEvent)
      }
    }

    outputHandler.onEnd()
  }

  private async processToolCalls(toolCalls: ClientToolCall[]): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = []

    for (const toolCall of toolCalls) {
      let result: {[key: string]: unknown}

      if (toolCall.name === 'execute_mcp_tool') {
        // Server sends tool_name and arguments at the top level of the SSE event
        const rawData = toolCall as unknown as {tool_name?: string; arguments?: {[key: string]: unknown}}
        const mcpToolName = rawData.tool_name ?? ''
        const mcpArguments = rawData.arguments ?? {}
        // Extract server name from the MCP tool name (first segment before _)
        const [serverName, ...toolNameParts] = mcpToolName.split('_')
        const toolName = toolNameParts.join('_')

        const toolRequest: ToolCallRequest = {
          name: mcpToolName,
          serverName: serverName ?? '',
          arguments: mcpArguments,
        }

        // eslint-disable-next-line no-await-in-loop
        const permission = await checkToolPermission(toolRequest, this.permissionOptions)
        if (permission === 'approved') {
          // eslint-disable-next-line no-await-in-loop
          result = await this.mcpManager.executeToolCall(serverName ?? '', toolName, mcpArguments)
        } else {
          result = {error: 'Tool call denied by user'}
        }
      } else if (toolCall.name === 'execute_shell_command') {
        // Server sends command/working_directory at the top level of the SSE event
        const rawData = toolCall as unknown as {command?: string; working_directory?: string}
        const command = rawData.command ?? ''
        // eslint-disable-next-line no-await-in-loop
        const permission = await checkShellPermission(command, this.permissionOptions)
        if (permission === 'approved') {
          // eslint-disable-next-line no-await-in-loop
          result = await this.executeShellCommand(command, rawData.working_directory)
        } else {
          result = {error: 'Shell command denied by user'}
        }
      } else {
        result = {error: `Unknown client tool: ${toolCall.name}`}
      }

      results.push({
        toolMessageId: toolCall.id,
        result,
      })
    }

    return results
  }

  private async executeShellCommand(command: string, workingDirectory?: string): Promise<{[key: string]: unknown}> {
    try {
      const {exec} = await import('child_process')
      const {promisify} = await import('util')
      const execAsync = promisify(exec)
      const options: {cwd?: string} = {}
      if (workingDirectory) {
        options.cwd = workingDirectory
      }
      const {stdout, stderr} = await execAsync(command, options)
      return {output: stdout, stderr, exit_code: 0}
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error: unknown) {
      const execError = error as {stdout?: string; stderr?: string; code?: number}
      return {output: execError.stdout ?? '', stderr: execError.stderr ?? '', exit_code: execError.code ?? 1}
    }
  }
}
