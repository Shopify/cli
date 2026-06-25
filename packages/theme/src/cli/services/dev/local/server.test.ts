import {createLocalDevServer} from './server.js'
import {LocalDevServerContext, ThemeRenderer} from './types.js'
import {createReloadTransport} from './reload-transport.js'
import {fakeThemeFileSystem} from '../../../utilities/theme-fs/theme-fs-mock-factory.js'
import {describe, expect, test, vi} from 'vitest'
import type {Server} from 'node:http'

function buildContext(): LocalDevServerContext {
  const renderer: ThemeRenderer = {render: vi.fn(async () => ({body: 'x', status: 200, headers: {}}))}
  return {
    directory: 'tmp',
    host: '127.0.0.1',
    port: 1234,
    liveReload: 'local-hot-reload',
    localThemeFileSystem: fakeThemeFileSystem('tmp', new Map()),
    lastRequestedPath: '',
    renderer,
  }
}

/* A fake node:http server that records listen/close calls and never binds a
   socket. `listen` invokes its callback synchronously so `start()` resolves. */
function fakeHttpServer() {
  const listen = vi.fn((_options: unknown, cb: () => void) => {
    cb()
    return server
  })
  const closeAllConnections = vi.fn()
  const close = vi.fn((cb?: () => void) => {
    cb?.()
    return server
  })
  const server = {listen, closeAllConnections, close} as unknown as Server
  return {server, listen, closeAllConnections, close}
}

describe('createLocalDevServer', () => {
  test('start() listens on the context host and port using the injected factory', async () => {
    // Given
    const ctx = buildContext()
    const {server, listen} = fakeHttpServer()
    const createServer = vi.fn(() => server)

    // When
    const devServer = createLocalDevServer(ctx, createReloadTransport(), {createServer})
    await devServer.start()

    // Then
    expect(createServer).toHaveBeenCalledOnce()
    expect(listen).toHaveBeenCalledOnce()
    expect(listen.mock.calls[0]?.[0]).toEqual({port: 1234, host: '127.0.0.1'})
  })

  test('close() severs connections then closes the server', async () => {
    // Given
    const ctx = buildContext()
    const {server, closeAllConnections, close} = fakeHttpServer()
    const createServer = vi.fn(() => server)

    // When
    const devServer = createLocalDevServer(ctx, createReloadTransport(), {createServer})
    const instance = await devServer.start()
    await instance.close()

    // Then
    expect(closeAllConnections).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })
})
