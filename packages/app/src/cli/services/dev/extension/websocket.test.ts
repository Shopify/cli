import {ExtensionsPayloadStore, ExtensionsPayloadStoreEvent} from './payload/store.js'
import {setupWebsocketConnection} from './websocket.js'
import {websocketUpgradeHandler, getPayloadUpdateHandler} from './websocket/handlers.js'
import {ExtensionDevOptions} from '../extension.js'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import {WebSocketServer} from 'ws'
import {Server} from 'https'

vi.mock('./websocket/handlers.js')
vi.mock('ws')

describe('setupWebsocketConnection', () => {
  const websocketServer = new WebSocketServer()
  const handler: any = {}
  const payloadStore: ExtensionsPayloadStore = {on: vi.fn()} as any
  const httpServer: Server = {on: vi.fn()} as any
  const devOptions = {} as unknown as ExtensionDevOptions
  const options = {...devOptions, httpServer, payloadStore, websocketURL: 'wss://mock.url/extensions'}

  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(WebSocketServer).mockReturnValue(websocketServer)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('handles upgrades in the HTTP server', () => {
    // Given
    vi.mocked(websocketUpgradeHandler).mockReturnValue(handler)

    // When
    setupWebsocketConnection(options)

    // Then
    expect(websocketUpgradeHandler).toHaveBeenCalledWith(websocketServer, options)
    expect(httpServer.on).toHaveBeenCalledWith('upgrade', handler)
  })
  test('handles payload store updates and notifies the clients', () => {
    // Given
    vi.mocked(getPayloadUpdateHandler).mockReturnValue(handler)

    // When
    setupWebsocketConnection(options)

    // Then
    expect(getPayloadUpdateHandler).toHaveBeenCalledWith(websocketServer, options)
    expect(payloadStore.on).toHaveBeenCalledWith(ExtensionsPayloadStoreEvent.Update, handler)
  })

  test('closes the connection when close is called', () => {
    // Given
    vi.mocked(getPayloadUpdateHandler).mockReturnValue(handler)

    // When
    setupWebsocketConnection(options).close()

    // Then
    expect(websocketServer.close).toHaveBeenCalled()
  })

  test('pings alive clients periodically to keep the connection alive', () => {
    // Given
    const client = {readyState: 1, ping: vi.fn()}
    WebSocketServer.prototype.clients = [client] as any
    vi.mocked(getPayloadUpdateHandler).mockReturnValue(handler)

    // When
    setupWebsocketConnection(options)
    vi.advanceTimersToNextTimer()

    // Then
    expect(client.ping).toHaveBeenCalled()
  })

  test("doesn't ping disconnected clients periodically", () => {
    // Given
    const client = {readyState: 3, ping: vi.fn()}
    WebSocketServer.prototype.clients = [client] as any
    vi.mocked(getPayloadUpdateHandler).mockReturnValue(handler)

    // When
    setupWebsocketConnection(options)
    vi.advanceTimersToNextTimer()

    // Then
    expect(client.ping).not.toHaveBeenCalled()
  })
})
