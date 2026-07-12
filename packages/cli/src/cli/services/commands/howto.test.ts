import {howtoService} from './howto.js'
import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'
import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderMarkdownStream} from '@shopify/cli-kit/node/ui'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/ui')

// Builds a fake streaming Response whose body yields the given raw SSE text as a
// single chunk (or a few pre-split chunks, to exercise cross-chunk buffering).
function streamingResponse(chunks: string[]) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) yield Buffer.from(chunk)
      },
    },
    text: () => Promise.resolve(''),
  } as any
}

function sseMessage(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

let writeSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  // Most tests exercise the plain, non-interactive output path. TTY-specific behaviour
  // is covered separately below.
  vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
})

afterEach(() => {
  writeSpy.mockRestore()
})

describe('howtoService', () => {
  test('sends the task wrapped in a guarding prompt to the assistant endpoint', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(streamingResponse([sseMessage('complete', null)]))

    await howtoService('Create an app with a checkout extension')

    expect(shopifyFetch).toHaveBeenCalledWith(
      'https://shopify.dev/assistant/conversations',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'X-Shopify-Surface': 'cli',
        },
      }),
      'slow-request',
    )

    const {body} = vi.mocked(shopifyFetch).mock.calls[0]![1]!
    const {prompt, prompt_history: promptHistory} = JSON.parse(body as string)
    expect(prompt).toContain('Create an app with a checkout extension')
    expect(prompt).toContain('shopify howto')
    expect(promptHistory).toEqual([])
  })

  test('tells the assistant Shopify CLI is already installed, with its version', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(streamingResponse([sseMessage('complete', null)]))

    await howtoService('Create an app')

    const {body} = vi.mocked(shopifyFetch).mock.calls[0]![1]!
    const {prompt} = JSON.parse(body as string)
    expect(prompt).toContain(`Shopify CLI ${CLI_KIT_VERSION}`)
    expect(prompt).toContain('already installed')
  })

  test('streams each response token to stdout in order and finishes with a newline', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(
      streamingResponse([
        sseMessage('start', {conversation_id: 'conv_123'}),
        sseMessage('response', 'Run '),
        sseMessage('response', '`shopify app init`'),
        sseMessage('complete', null),
      ]),
    )

    await howtoService('Create an app')

    expect(writeSpy.mock.calls.map(([chunk]: [string]) => chunk)).toEqual(['Run ', '`shopify app init`', '\n'])
  })

  test('reassembles a token split across multiple network chunks', async () => {
    const message = sseMessage('response', 'hello world')
    const splitPoint = Math.floor(message.length / 2)

    vi.mocked(shopifyFetch).mockResolvedValue(
      streamingResponse([message.slice(0, splitPoint), message.slice(splitPoint), sseMessage('complete', null)]),
    )

    await howtoService('Create an app')

    expect(writeSpy.mock.calls.map(([chunk]: [string]) => chunk)).toEqual(['hello world', '\n'])
  })

  test('does not print a trailing newline when no tokens were streamed', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(streamingResponse([sseMessage('complete', null)]))

    await howtoService('Create an app')

    expect(writeSpy).not.toHaveBeenCalled()
  })

  test('raises a friendly error when the assistant sends an error event', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(
      streamingResponse([sseMessage('response', 'partial answer'), sseMessage('error', null)]),
    )

    await expect(howtoService('Create an app')).rejects.toThrowError(AbortError)
    await expect(howtoService('Create an app')).rejects.toThrowError(/could not complete this request/)
  })

  test('raises an error for a non-ok response', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      body: null,
      text: () => Promise.resolve('boom'),
    } as any)

    await expect(howtoService('Create an app')).rejects.toThrowError(AbortError)
    await expect(howtoService('Create an app')).rejects.toThrowError(/500 Internal Server Error/)
  })

  test('reports a friendly error when the request cannot reach shopify.dev', async () => {
    vi.mocked(shopifyFetch).mockRejectedValue(new Error('getaddrinfo ENOTFOUND shopify.dev'))

    await expect(howtoService('Create an app')).rejects.toThrowError(AbortError)
    await expect(howtoService('Create an app')).rejects.toThrowError(/Could not reach shopify\.dev/)
  })

  test('reports a friendly error when the stream breaks mid-response', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(sseMessage('response', 'partial'))
          throw new Error('socket hang up')
        },
      },
      text: () => Promise.resolve(''),
    } as any)

    await expect(howtoService('Create an app')).rejects.toThrowError(AbortError)
    await expect(howtoService('Create an app')).rejects.toThrowError(/Lost connection to shopify\.dev/)
  })
})

describe('howtoService in an interactive terminal', () => {
  beforeEach(() => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    // Drive the task exactly like the real `renderMarkdownStream` would: run it and
    // record every call to `updateContent`, without actually mounting an Ink app.
    vi.mocked(renderMarkdownStream).mockImplementation(async ({task}) => task(() => {}))
  })

  test('streams accumulated content through renderMarkdownStream instead of writing to stdout directly', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(
      streamingResponse([
        sseMessage('response', 'Run '),
        sseMessage('response', '`shopify app init`'),
        sseMessage('complete', null),
      ]),
    )

    const updates: string[] = []
    vi.mocked(renderMarkdownStream).mockImplementation(async ({task}) => task((content) => updates.push(content)))

    await howtoService('Create an app')

    expect(renderMarkdownStream).toHaveBeenCalled()
    expect(updates).toEqual(['Run ', 'Run `shopify app init`'])
    expect(writeSpy).not.toHaveBeenCalled()
  })

  test('propagates a stream error out of renderMarkdownStream', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(streamingResponse([sseMessage('error', null)]))

    await expect(howtoService('Create an app')).rejects.toThrowError(AbortError)
  })
})
