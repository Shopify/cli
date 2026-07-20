import {askAssistant, parseServerSentEvent} from './assistant.js'
import {describe, expect, test} from 'vitest'
import type {Response} from '@shopify/cli-kit/node/http'

function sseChunksToAsyncIterable(chunks: (string | Buffer)[]): AsyncIterable<Buffer> {
  return {
    [Symbol.asyncIterator]: () => {
      let index = 0
      return {
        next: async () => {
          if (index >= chunks.length) return {done: true, value: undefined}
          const chunk = chunks[index]!
          const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8')
          index++
          return {done: false, value}
        },
      }
    },
  }
}

function fakeStreamingResponse(chunks: (string | Buffer)[]): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: sseChunksToAsyncIterable(chunks),
    text: async () => '',
  } as unknown as Response
}

describe('parseServerSentEvent', () => {
  test('parses the event name and data payload', () => {
    expect(parseServerSentEvent('event: response\ndata: "hello"')).toEqual({event: 'response', data: '"hello"'})
  })

  test('defaults to a "message" event when no event line is present', () => {
    expect(parseServerSentEvent('data: "hello"')).toEqual({event: 'message', data: '"hello"'})
  })

  test('strips a trailing \\r from each line for CRLF-framed messages', () => {
    expect(parseServerSentEvent('event: response\r\ndata: "hello"\r')).toEqual({event: 'response', data: '"hello"'})
  })

  test('joins multiple data lines with a newline', () => {
    expect(parseServerSentEvent('data: line one\ndata: line two')).toEqual({
      event: 'message',
      data: 'line one\nline two',
    })
  })
})

describe('askAssistant', () => {
  test('accumulates tokens from response events until the complete event', async () => {
    const response = fakeStreamingResponse([
      'event: response\ndata: "Hello"\n\n',
      'event: response\ndata: ", world"\n\n',
      'event: complete\ndata:\n\n',
    ])

    const result = await askAssistant('What were my sales last month?', {fetchAssistant: async () => response})

    expect(result).toBe('Hello, world')
  })

  test('handles a response split across multiple chunks', async () => {
    const response = fakeStreamingResponse(['event: resp', 'onse\ndata: "Hello"\n\n', 'event: complete\ndata:\n\n'])

    const result = await askAssistant('What were my sales last month?', {fetchAssistant: async () => response})

    expect(result).toBe('Hello')
  })

  test('throws an AbortError when the assistant emits an error event', async () => {
    const response = fakeStreamingResponse(['event: error\ndata: something went wrong\n\n'])

    await expect(
      askAssistant('What were my sales last month?', {fetchAssistant: async () => response}),
    ).rejects.toThrow('The Shopify assistant could not complete this request.')
  })

  test('throws an AbortError when the response is not ok', async () => {
    const response = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      body: sseChunksToAsyncIterable([]),
      text: async () => 'boom',
    } as unknown as Response

    await expect(
      askAssistant('What were my sales last month?', {fetchAssistant: async () => response}),
    ).rejects.toThrow('Assistant request failed: 500 Internal Server Error — boom')
  })

  test('throws an AbortError when the fetch itself fails', async () => {
    await expect(
      askAssistant('What were my sales last month?', {
        fetchAssistant: async () => {
          throw new Error('network down')
        },
      }),
    ).rejects.toThrow('Could not reach shopify.dev to generate the report query.')
  })

  test('throws an AbortError when the stream ends without a complete event', async () => {
    // An interrupted connection must not be treated as a successful (if empty/partial) response.
    const response = fakeStreamingResponse(['event: response\ndata: "Hello"\n\n'])

    await expect(
      askAssistant('What were my sales last month?', {fetchAssistant: async () => response}),
    ).rejects.toThrow('The connection to shopify.dev ended before the report query finished generating.')
  })

  test('decodes a multibyte character split across a chunk boundary', async () => {
    const payload = JSON.stringify('café')
    const frame = Buffer.from(`event: response\ndata: ${payload}\n\nevent: complete\ndata:\n\n`, 'utf8')
    // "é" is the 2-byte UTF-8 sequence 0xC3 0xA9. Split right after its first byte so neither
    // chunk is valid UTF-8 on its own.
    const splitIndex = frame.indexOf(0xc3) + 1
    const response = fakeStreamingResponse([frame.subarray(0, splitIndex), frame.subarray(splitIndex)])

    const result = await askAssistant('What were my sales last month?', {fetchAssistant: async () => response})

    expect(result).toBe('café')
  })

  test('parses a stream framed with CRLF ("\\r\\n\\r\\n") message boundaries', async () => {
    const response = fakeStreamingResponse([
      'event: response\r\ndata: "Hello"\r\n\r\n',
      'event: complete\r\ndata:\r\n\r\n',
    ])

    const result = await askAssistant('What were my sales last month?', {fetchAssistant: async () => response})

    expect(result).toBe('Hello')
  })
})
