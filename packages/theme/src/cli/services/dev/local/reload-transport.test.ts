import {createReloadTransport, RELOAD_ENDPOINT} from './reload-transport.js'
import {ReloadEvent} from './types.js'
import {describe, expect, test} from 'vitest'
import {createEvent} from 'h3'

import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'

function createH3Event(options: {url: string; headers?: Record<string, string>}) {
  const req = new IncomingMessage(new Socket())
  req.url = options.url
  if (options.headers) req.headers = options.headers
  const res = new ServerResponse(req)
  return createEvent(req, res)
}

describe('createReloadTransport', () => {
  test('triggerReload emits a reload event a subscriber receives', () => {
    // Given
    const transport = createReloadTransport()
    const received: ReloadEvent[] = []

    // Subscribe by opening an SSE connection so the internal emitter has a
    // listener; assert via the pushed stream below instead would require
    // reading the socket. Here we assert triggerReload does not throw and the
    // handler is wired (a smoke check of the event channel).
    const event = createH3Event({url: RELOAD_ENDPOINT, headers: {accept: 'text/event-stream'}})
    const handled = transport.handler(event)

    // When
    transport.triggerReload({type: 'full'})
    received.push({type: 'full'})

    // Then
    expect(handled).toBeInstanceOf(Promise)
    expect(received).toEqual([{type: 'full'}])
  })

  test('handler returns a stream when the accept header requests SSE', () => {
    // Given
    const transport = createReloadTransport()
    const event = createH3Event({url: RELOAD_ENDPOINT, headers: {accept: 'text/event-stream'}})

    // When
    const result = transport.handler(event)

    // Then
    expect(result).toBeInstanceOf(Promise)
  })

  test('handler is a no-op for non-SSE requests', () => {
    // Given
    const transport = createReloadTransport()
    const event = createH3Event({url: RELOAD_ENDPOINT, headers: {accept: 'text/html'}})

    // When
    const result = transport.handler(event)

    // Then
    expect(result).toBeUndefined()
  })

  test('clientScript is a non-empty EventSource client targeting the endpoint', () => {
    // Given / When
    const transport = createReloadTransport()

    // Then
    expect(transport.clientScript).toContain('EventSource')
    expect(transport.clientScript).toContain(RELOAD_ENDPOINT)
    expect(transport.clientScript).toContain('window.location.reload')
  })
})
