import {shopifyFetch, type Response} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'
import {StringDecoder} from 'node:string_decoder'

// The dev-assistant conversations endpoint is the same one that powers the "Ask AI" widget on
// shopify.dev. It streams a Server-Sent Events response.
const ASSISTANT_URL = 'https://shopify.dev/assistant/conversations'

// Identifies the CLI as the calling surface to shopify.dev, so traffic originating from the CLI
// can be attributed as such.
const SURFACE_HEADER = 'X-Shopify-Surface'
const SURFACE = 'cli'

// A decoded Server-Sent Events message: the named event and its `data:` payload. Fields other
// than `event`/`data` (like `retry:`) are intentionally ignored.
interface ServerSentEvent {
  event: string
  data: string
}

// Matches the blank-line boundary between two SSE messages. The spec permits either LF or CRLF
// line endings, so the boundary is either "\n\n" or "\r\n\r\n".
const MESSAGE_BOUNDARY = /\r\n\r\n|\n\n/

interface MessageBoundary {
  index: number
  length: number
}

function findMessageBoundary(buffer: string): MessageBoundary | undefined {
  const match = MESSAGE_BOUNDARY.exec(buffer)
  return match ? {index: match.index, length: match[0].length} : undefined
}

// Parses one complete SSE message (the text between two blank lines) into its event name and
// data payload. SSE defaults to `event: message` when no event name is sent. Exported for
// testing since it's the trickiest piece of the streaming parser.
export function parseServerSentEvent(block: string): ServerSentEvent {
  let event = 'message'
  const dataLines: string[] = []

  for (const rawLine of block.split('\n')) {
    // Tolerate CRLF-terminated lines: a "\r\n\r\n"-framed message still has an interior "\n" split
    // point per line, each carrying a trailing "\r" that isn't part of the field value.
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine

    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim())
    }
  }

  return {event, data: dataLines.join('\n')}
}

export interface AskAssistantDependencies {
  fetchAssistant: typeof shopifyFetch
}

const defaultAskAssistantDependencies: AskAssistantDependencies = {
  fetchAssistant: shopifyFetch,
}

/**
 * Sends a single-turn prompt to the shopify.dev assistant and returns its full accumulated
 * answer. Throws an `AbortError` for network failures, non-ok responses, or an `error` event from
 * the assistant.
 */
export async function askAssistant(
  prompt: string,
  dependencies: Partial<AskAssistantDependencies> = {},
): Promise<string> {
  const {fetchAssistant} = {...defaultAskAssistantDependencies, ...dependencies}

  let response: Response
  try {
    response = await fetchAssistant(
      ASSISTANT_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          [SURFACE_HEADER]: SURFACE,
        },
        body: JSON.stringify({prompt, prompt_history: []}),
      },
      // This is a slow, streaming, non-idempotent request: don't retry it on network errors, and
      // don't cancel it just because it's taking a while to fully stream.
      'slow-request',
    )
  } catch {
    throw new AbortError(
      'Could not reach shopify.dev to generate the report query.',
      'Check your network connection and try again.',
    )
  }

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => '')
    throw new AbortError(
      `Assistant request failed: ${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`,
    )
  }

  // node-fetch's TypeScript definitions type `body` as `NodeJS.ReadableStream`, which doesn't
  // declare `Symbol.asyncIterator`, even though the stream implements it at runtime. Cast so we
  // can iterate it directly with `for await`.
  const body = response.body as unknown as AsyncIterable<Buffer>

  let buffer = ''
  let accumulated = ''
  // Buffers span multiple chunks are decoded byte-by-byte from the network, so a multibyte UTF-8
  // character can be split across two chunks. `StringDecoder` holds back incomplete trailing
  // bytes until the rest of the character arrives instead of corrupting it with `chunk.toString`.
  const decoder = new StringDecoder('utf8')

  try {
    for await (const chunk of body) {
      buffer += decoder.write(chunk)

      // SSE messages are separated by a blank line. Process every complete message and keep any
      // trailing partial message in the buffer for the next chunk.
      let boundary = findMessageBoundary(buffer)
      while (boundary) {
        const message = parseServerSentEvent(buffer.slice(0, boundary.index))
        buffer = buffer.slice(boundary.index + boundary.length)

        if (message.event === 'response' && message.data) {
          // Each `response` event's data is a JSON-encoded string containing one token.
          accumulated += JSON.parse(message.data) as string
        } else if (message.event === 'error') {
          throw new AbortError('The Shopify assistant could not complete this request.', 'Wait a moment and try again.')
        } else if (message.event === 'complete') {
          return accumulated
        }

        boundary = findMessageBoundary(buffer)
      }
    }
  } catch (error) {
    if (error instanceof AbortError) throw error
    throw new AbortError(
      'Lost connection to shopify.dev while generating the report query.',
      'Check your network connection and try again.',
    )
  }

  // The stream ended without a `complete` event. That's an interrupted response, not a successful
  // (if empty) one, so the partial `accumulated` text must not be returned as if it were final.
  throw new AbortError(
    'The connection to shopify.dev ended before the report query finished generating.',
    'Wait a moment and try again.',
  )
}
