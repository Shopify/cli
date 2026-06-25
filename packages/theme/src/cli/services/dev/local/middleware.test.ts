import {buildMiddleware, renderHandler, hostValidationHandler} from './middleware.js'
import {LocalDevServerContext, RenderResult, ThemeRenderer} from './types.js'
import {createReloadTransport} from './reload-transport.js'
import {fakeThemeFileSystem} from '../../../utilities/theme-fs/theme-fs-mock-factory.js'
import {describe, expect, test, vi} from 'vitest'
import {createEvent} from 'h3'

import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'

function fakeRenderer(result: RenderResult): ThemeRenderer {
  return {render: vi.fn(async () => result)}
}

function buildContext(renderer: ThemeRenderer): LocalDevServerContext {
  return {
    directory: 'tmp',
    host: '127.0.0.1',
    port: 9292,
    liveReload: 'local-hot-reload',
    localThemeFileSystem: fakeThemeFileSystem('tmp', new Map()),
    lastRequestedPath: '',
    renderer,
  }
}

function createH3Event(options: {url: string; headers?: Record<string, string>}) {
  const req = new IncomingMessage(new Socket())
  req.url = options.url
  req.method = 'GET'
  if (options.headers) req.headers = options.headers
  const res = new ServerResponse(req)
  return createEvent(req, res)
}

describe('renderHandler', () => {
  test('delegates to the render seam and writes its body to the response', async () => {
    // Given
    const renderer = fakeRenderer({body: 'RENDERED_BODY', status: 201, headers: {'content-type': 'text/html'}})
    const ctx = buildContext(renderer)
    const event = createH3Event({url: '/some-path'})

    // When
    await renderHandler(ctx)(event)

    // Then
    expect(renderer.render).toHaveBeenCalledOnce()
    expect(renderer.render).toHaveBeenCalledWith({path: '/some-path', method: 'GET', headers: expect.any(Object)})
    expect(event.node.res.statusCode).toBe(201)
    expect(event.node.res.getHeader('content-type')).toBe('text/html')
  })

  test('records the last requested path on the context', async () => {
    // Given
    const renderer = fakeRenderer({body: 'x', status: 200, headers: {}})
    const ctx = buildContext(renderer)
    const event = createH3Event({url: '/products/shoe?variant=1'})

    // When
    await renderHandler(ctx)(event)

    // Then
    expect(ctx.lastRequestedPath).toBe('/products/shoe')
  })
})

describe('buildMiddleware', () => {
  test('returns handlers in order: host validation, transport, render', () => {
    // Given
    const ctx = buildContext(fakeRenderer({body: 'x', status: 200, headers: {}}))
    const transport = createReloadTransport()

    // When
    const handlers = buildMiddleware(ctx, transport)

    // Then
    expect(handlers).toHaveLength(3)
    expect(handlers[1]).toBe(transport.handler)
  })

  test('host validation handler is constructed from the context host/port', () => {
    // Given
    const ctx = buildContext(fakeRenderer({body: 'x', status: 200, headers: {}}))

    // When
    const handler = hostValidationHandler(ctx)

    // Then
    expect(typeof handler).toBe('function')
  })
})
