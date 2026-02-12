import {fetch} from '@shopify/cli-kit/node/http'

export interface SidekickMessage {
  content: string
  conversationId?: string
  toolCallResults?: ToolCallResult[]
}

export interface ToolCallResult {
  toolMessageId: string
  result: {[key: string]: unknown}
}

export interface SSEEvent {
  type:
    | 'message'
    | 'tool_call_start'
    | 'client_tool_call'
    | 'conversation_title'
    | 'end'
    | 'error'
    | 'server_error'
    | 'llm_error'
    | 'llm_content_error'
  data: string
}

export interface ClientToolCall {
  id: string
  toolCallId: string
  type: string
  name: string
  arguments: {[key: string]: unknown}
  preview?: string
}

export interface SidekickClientOptions {
  apiEndpoint: string
  token: string
  storeHandle: string
  conversationId?: string
  refreshToken?: () => Promise<string>
}

export type SSEEventHandler = (event: SSEEvent) => void | Promise<void>

export class SidekickClient {
  private readonly apiEndpoint: string
  private token: string
  private readonly storeHandle: string
  private readonly refreshToken?: () => Promise<string>
  private conversationId: string | undefined
  private abortController: AbortController | null = null

  constructor(options: SidekickClientOptions) {
    this.apiEndpoint = options.apiEndpoint
    this.token = options.token
    this.storeHandle = options.storeHandle
    this.refreshToken = options.refreshToken
    this.conversationId = options.conversationId
  }

  async sendMessage(content: string, onEvent: SSEEventHandler): Promise<void> {
    const body: {[key: string]: unknown} = {
      message: {
        content,
        scenario: 'SidekickCLI',
        features: ['merchant/cli'],
        ...(this.conversationId ? {conversation_id: this.conversationId} : {}),
      },
    }

    const stream = await this.postMessage(body)
    await this.parseSSEStream(stream, onEvent)
  }

  async sendToolResults(toolResults: ToolCallResult[], onEvent: SSEEventHandler): Promise<void> {
    const body = {
      message: {
        conversation_id: this.conversationId,
        content: '',
        scenario: 'SidekickCLI',
        features: ['merchant/cli'],
        tool_call_results: toolResults.map((result) => ({
          tool_message_id: result.toolMessageId,
          result: result.result,
        })),
      },
    }

    const stream = await this.postMessage(body)
    await this.parseSSEStream(stream, onEvent)
  }

  setConversationId(id: string): void {
    this.conversationId = id
  }

  abort(): void {
    this.abortController?.abort()
    this.abortController = null
  }

  private async postMessage(body: {[key: string]: unknown}): Promise<AsyncIterable<Uint8Array>> {
    const attempt = async () => {
      this.abortController = new AbortController()

      return fetch(`${this.apiEndpoint}/api/store/${this.storeHandle}/messages`, {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      })
    }

    let response = await attempt()

    // On 401, try refreshing the token once and retry
    if (response.status === 401 && this.refreshToken) {
      this.token = await this.refreshToken()
      response = await attempt()
    }

    if (!response.ok) {
      throw new Error(`Sidekick API error: ${response.status} ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('No response body received from Sidekick API')
    }

    return response.body as unknown as AsyncIterable<Uint8Array>
  }

  private async parseSSEStream(stream: AsyncIterable<Uint8Array>, onEvent: SSEEventHandler): Promise<void> {
    const decoder = new TextDecoder()
    let buffer = ''
    let eventType = 'message'
    let dataLines: string[] = []

    for await (const chunk of stream) {
      buffer += decoder.decode(chunk, {stream: true})
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const value = line.slice(5)
          dataLines.push(value.startsWith(' ') ? value.slice(1) : value)
        } else if (line === '') {
          if (dataLines.length > 0) {
            const event: SSEEvent = {
              type: eventType as SSEEvent['type'],
              data: dataLines.join('\n'),
            }
            // eslint-disable-next-line no-await-in-loop
            await onEvent(event)
            eventType = 'message'
            dataLines = []
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const remainingLines = buffer.split('\n')
      for (const line of remainingLines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const value = line.slice(5)
          dataLines.push(value.startsWith(' ') ? value.slice(1) : value)
        }
      }
      if (dataLines.length > 0) {
        await onEvent({type: eventType as SSEEvent['type'], data: dataLines.join('\n')})
      }
    }
  }
}
