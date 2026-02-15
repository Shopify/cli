import {SidekickClient, SSEEvent, ClientToolCall, ToolCallResult} from './sidekick-client.js'
import {MCPManager} from './mcp-manager.js'
import {createOutputHandler, OutputFormat} from './output.js'
import {checkToolPermission, checkShellPermission, checkGraphqlMutationPermission, PermissionOptions, ToolCallRequest, PermissionResult} from './permissions.js'
import {outputDebug, outputNewline} from '@shopify/cli-kit/node/output'
import {renderText, renderTextPrompt} from '@shopify/cli-kit/node/ui'

const MAX_TOOL_CALL_ITERATIONS = 20

export interface PermissionRequest {
  type: 'mutation' | 'shell' | 'mcp_tool'
  description: string
  detail: string
}

export interface SessionCallbacks {
  onChunk: (chunk: string) => void
  onToolCallStart: (toolCall: ClientToolCall) => void
  onToolCallEnd: (toolCallId: string, result: string, error?: string) => void
  onPermissionRequest: (request: PermissionRequest) => Promise<boolean>
  onError: (type: string, message: string) => void
  onEnd: () => void
}

export interface TerminalSessionOptions {
  apiEndpoint: string
  token: string
  storeHandle: string
  format: OutputFormat
  yolo: boolean
  interactive: boolean
  stdinContent?: string
  workingDirectory?: string
  refreshToken?: () => Promise<string>
}

export class TerminalSession {
  public readonly client: SidekickClient
  public readonly mcpManager: MCPManager
  private readonly format: OutputFormat
  private readonly permissionOptions: PermissionOptions
  private readonly isInteractive: boolean
  private readonly stdinContent: string | undefined
  private readonly workingDirectory: string | undefined
  private isFirstPrompt = true

  constructor(options: TerminalSessionOptions) {
    this.client = new SidekickClient({
      apiEndpoint: options.apiEndpoint,
      token: options.token,
      storeHandle: options.storeHandle,
      refreshToken: options.refreshToken,
    })
    this.mcpManager = new MCPManager({workingDirectory: options.workingDirectory})
    this.format = options.format
    this.permissionOptions = {
      yolo: options.yolo,
      interactive: options.interactive,
    }
    this.isInteractive = options.interactive
    this.stdinContent = options.stdinContent
    this.workingDirectory = options.workingDirectory
  }

  async initialize(): Promise<void> {
    await this.mcpManager.initialize()
  }

  async oneShot(prompt: string): Promise<void> {
    const {content, context} = this.buildMessage(prompt)
    await this.sendAndProcess(content, context)
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

        // During streaming, Ctrl+C aborts the current turn instead of exiting
        let aborted = false
        const abortHandler = () => {
          aborted = true
          this.client.abort()
        }
        process.on('SIGINT', abortHandler)

        try {
          const {content, context} = this.buildMessage(prompt)
          // eslint-disable-next-line no-await-in-loop
          await this.sendAndProcess(content, context)
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch {
          if (!aborted) throw new Error('interrupted')
          outputNewline()
        } finally {
          process.removeListener('SIGINT', abortHandler)
        }
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        // User cancelled (Ctrl+C) during prompt input
        running = false
      }
    }
  }

  async sendWithCallbacks(prompt: string, callbacks: SessionCallbacks): Promise<void> {
    const {content, context} = this.buildMessage(prompt)
    await this.sendAndProcess(content, context, callbacks)
  }

  shutdown(): void {
    this.client.abort()
    this.mcpManager.shutdown().catch(() => {
      // Ignore shutdown errors
    })
  }

  private buildMessage(prompt: string): {content: string; context?: string} {
    const parts: string[] = [prompt]

    if (this.stdinContent) {
      parts.push(`<user_provided_data>\n${this.stdinContent}\n</user_provided_data>`)
    }

    let context: string | undefined
    if (this.isFirstPrompt) {
      context = this.buildContext()
      this.isFirstPrompt = false
    }

    return {content: parts.join('\n\n'), context}
  }

  private buildContext(): string {
    const lines = [
      '<cli_context>',
      'You are running inside the Shopify CLI terminal, not the admin web UI.',
      'The user is a developer interacting with you from their local machine.',
      'You have access to execute_shell_command to run commands on their system.',
      'Use it when asked to perform local operations like listing files, running scripts, or inspecting the environment.',
      '',
      'MANDATORY RULE: Your FIRST action for ANY Shopify-related request MUST be to call fetch_help_documents. Do this BEFORE responding, BEFORE running shell commands, BEFORE doing anything else. This applies to every request about apps, themes, stores, deployment, configuration, extensions, functions, hydrogen, or any other Shopify topic. You do not have reliable knowledge of Shopify CLI commands or Shopify development workflows — you MUST look them up every time. Do not mention that you are checking documentation; just call the tool silently as your first step.',
    ]

    if (!this.isInteractive) {
      lines.push(
        '',
        'INTERACTION MODE: This is a ONE-SHOT command-line invocation. There will be NO follow-up messages — this is the only turn. Deliver a complete, self-contained answer. Do not ask clarifying questions, suggest follow-ups, or say "let me know if you need more details". Be thorough and definitive in this single response.',
      )
    }

    if (this.workingDirectory) {
      lines.push(
        `The working directory is ${this.workingDirectory}. Use it as the default path for file operations unless the user specifies otherwise.`,
      )
    }

    const toolsXML = this.mcpManager.formatToolsAsXML()
    if (toolsXML) {
      lines.push(
        '',
        toolsXML,
        '',
        'You can call these tools using execute_mcp_tool with tool_name set to "serverName_toolName" (e.g., "filesystem_read_file") and the appropriate arguments. Prefer these tools over execute_shell_command for file operations.',
      )
    }

    lines.push('</cli_context>')
    return lines.join('\n')
  }

  private async sendAndProcess(prompt: string, context?: string, callbacks?: SessionCallbacks): Promise<void> {
    const outputHandler = callbacks ? null : createOutputHandler(this.format)
    let pendingToolCalls: ClientToolCall[] = []
    let iterationCount = 0

    const handleEvent = async (event: SSEEvent): Promise<void> => {
      switch (event.type) {
        case 'message': {
          if (callbacks) {
            callbacks.onChunk(event.data)
          } else {
            outputHandler?.onChunk(event.data)
          }
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
          if (callbacks) {
            callbacks.onError(event.type, errorMsg)
          } else {
            process.stderr.write(`Error: ${errorMsg}\n`)
          }
          break
        }
        default:
          break
      }
    }

    await this.client.sendMessage(prompt, handleEvent, context)

    // Process any pending tool calls
    while (pendingToolCalls.length > 0) {
      iterationCount++
      if (iterationCount > MAX_TOOL_CALL_ITERATIONS) {
        outputDebug(
          `Exceeded maximum tool call iterations (${MAX_TOOL_CALL_ITERATIONS}). Stopping to prevent infinite loop.`,
        )
        break
      }

      if (!callbacks) {
        outputNewline()
      }
      const toolCalls = [...pendingToolCalls]
      pendingToolCalls = []
      // eslint-disable-next-line no-await-in-loop
      const results = await this.processToolCalls(toolCalls, callbacks)

      // null means the user denied a permission prompt — stop the turn
      if (results === null) {
        break
      }

      if (results.length > 0) {
        if (!callbacks) {
          outputNewline()
        }
        // eslint-disable-next-line no-await-in-loop
        await this.client.sendToolResults(results, handleEvent)
      }
    }

    if (callbacks) {
      callbacks.onEnd()
    } else {
      outputHandler?.onEnd()
    }
  }

  private async processToolCalls(toolCalls: ClientToolCall[], callbacks?: SessionCallbacks): Promise<ToolCallResult[] | null> {
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
          annotations: this.mcpManager.getToolAnnotations(serverName ?? '', toolName),
        }

        let permission: PermissionResult
        if (toolRequest.annotations?.readOnlyHint === true || this.permissionOptions.yolo) {
          permission = 'approved'
        } else if (callbacks) {
          const permissionRequest: PermissionRequest = {
            type: 'mcp_tool',
            description: `Execute tool "${mcpToolName}" from server "${serverName}"`,
            detail: JSON.stringify(mcpArguments, null, 2),
          }
          // eslint-disable-next-line no-await-in-loop
          const approved = await callbacks.onPermissionRequest(permissionRequest)
          permission = approved ? 'approved' : 'denied'
        } else {
          // eslint-disable-next-line no-await-in-loop
          permission = await checkToolPermission(toolRequest, this.permissionOptions)
        }

        if (permission === 'approved') {
          if (callbacks) {
            callbacks.onToolCallStart(toolCall)
          } else {
            renderText({subdued: `  ▸ ${mcpToolName}`})
          }
          // eslint-disable-next-line no-await-in-loop
          result = await this.mcpManager.executeToolCall(serverName ?? '', toolName, mcpArguments)
          const output = (result.result as string) ?? (result.error as string) ?? ''
          const errorMsg = result.error as string | undefined
          if (callbacks) {
            callbacks.onToolCallEnd(toolCall.id, output, errorMsg)
          } else if (output.trim()) {
            renderText({subdued: formatShellOutput(output)})
          }
        } else {
          return null
        }
      } else if (toolCall.name === 'execute_shell_command') {
        // Server sends command/reason/working_directory at the top level of the SSE event
        const rawData = toolCall as unknown as {command?: string; reason?: string; working_directory?: string}
        const command = rawData.command ?? ''
        const reason = rawData.reason

        let permission: PermissionResult
        if (this.permissionOptions.yolo) {
          permission = 'approved'
        } else if (callbacks) {
          const permissionRequest: PermissionRequest = {
            type: 'shell',
            description: reason ?? `Execute shell command`,
            detail: command,
          }
          // eslint-disable-next-line no-await-in-loop
          const approved = await callbacks.onPermissionRequest(permissionRequest)
          permission = approved ? 'approved' : 'denied'
        } else {
          // eslint-disable-next-line no-await-in-loop
          permission = await checkShellPermission(command, reason, this.permissionOptions)
        }

        if (permission === 'approved') {
          if (callbacks) {
            callbacks.onToolCallStart(toolCall)
          }
          // eslint-disable-next-line no-await-in-loop
          result = await this.executeShellCommand(command, rawData.working_directory)
          const output = (result.output as string) ?? ''
          if (callbacks) {
            callbacks.onToolCallEnd(toolCall.id, output)
          } else if (output.trim()) {
            outputNewline()
            renderText({subdued: formatShellOutput(output)})
          }
        } else {
          return null
        }
      } else if (toolCall.name === 'confirm_graphql_mutation') {
        // Server sends query/variables/description at the top level of the SSE event
        const rawData = toolCall as unknown as {query?: string; variables?: {[key: string]: unknown}; description?: string}
        const query = rawData.query ?? ''
        const description = rawData.description

        let permission: PermissionResult
        if (this.permissionOptions.yolo) {
          permission = 'approved'
        } else if (callbacks) {
          const permissionRequest: PermissionRequest = {
            type: 'mutation',
            description: description ?? 'Execute GraphQL mutation',
            detail: query,
          }
          // eslint-disable-next-line no-await-in-loop
          const approved = await callbacks.onPermissionRequest(permissionRequest)
          permission = approved ? 'approved' : 'denied'
        } else {
          // eslint-disable-next-line no-await-in-loop
          permission = await checkGraphqlMutationPermission(query, description, this.permissionOptions)
        }

        if (permission === 'approved') {
          if (callbacks) {
            callbacks.onToolCallStart(toolCall)
            callbacks.onToolCallEnd(toolCall.id, JSON.stringify({confirmed: true}))
          }
          result = {confirmed: true}
        } else {
          return null
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
      const options: {cwd?: string; env?: NodeJS.ProcessEnv} = {}
      const resolvedWorkingDirectory = workingDirectory ?? this.workingDirectory
      if (resolvedWorkingDirectory) {
        options.cwd = resolvedWorkingDirectory
      }
      options.env = {...process.env, CI: 'true'}
      const {stdout, stderr} = await execAsync(command, options)
      return {output: stdout, stderr, exit_code: 0}
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error: unknown) {
      const execError = error as {stdout?: string; stderr?: string; code?: number}
      return {output: execError.stdout ?? '', stderr: execError.stderr ?? '', exit_code: execError.code ?? 1}
    }
  }
}

const MAX_OUTPUT_LINES = 20
const INDENT = '  '

function formatShellOutput(output: string): string {
  const lines = output.trimEnd().split('\n')
  const truncated = lines.length > MAX_OUTPUT_LINES
  const visible = truncated ? lines.slice(0, MAX_OUTPUT_LINES) : lines
  const indented = visible.map((line) => `${INDENT}${line}`).join('\n')
  if (truncated) {
    return `${indented}\n${INDENT}... (${lines.length - MAX_OUTPUT_LINES} more lines)`
  }
  return indented
}
