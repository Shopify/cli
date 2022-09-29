import {ExtensionsPayloadStore, ExtensionsPayloadStoreEvent} from './payload/store.js'
import {setupWebsocketConnection} from './websocket.js'
import {websocketUpgradeHandler, getPayloadUpdateHandler} from './websocket/handlers.js'
import {describe, test, expect, vi} from 'vitest'
import {WebSocketServer} from 'ws'
import {Server} from 'node:https'

vi.mock('./websocket/handlers.js')
vi.mock('ws')

describe('setupWebsocketConnection', () => {
  test('handles upgrades in the HTTP server', () => {
    // Given
    const websocketServer = new WebSocketServer()
    const handler: any = {}
    const payloadStore: ExtensionsPayloadStore = {on: vi.fn()} as any
    const httpServer: Server = {on: vi.fn()} as any
    const options = {httpServer, payloadStore}
    vi.mocked(websocketUpgradeHandler).mockReturnValue(handler)
    vi.useFakeTimers()

    // When
    setupWebsocketConnection(options)

    // Then
    expect(websocketUpgradeHandler).toHaveBeenCalledWith(websocketServer, options)
    expect(httpServer.on).toHaveBeenCalledWith('upgrade', handler)
  })
  test('handles payload store updates and notifies the clients', () => {
    // Given
    const websocketServer = new WebSocketServer()
    const handler: any = {}
    const payloadStore: ExtensionsPayloadStore = {on: vi.fn()} as any
    const httpServer: Server = {on: vi.fn()} as any
    const options = {httpServer, payloadStore}
    vi.mocked(getPayloadUpdateHandler).mockReturnValue(handler)
    vi.useFakeTimers()

    // When
    setupWebsocketConnection(options)

    // Then
    expect(getPayloadUpdateHandler).toHaveBeenCalledWith(websocketServer, options)
    expect(payloadStore.on).toHaveBeenCalledWith(ExtensionsPayloadStoreEvent.Update, handler)
  })

  test('closes the connection when close is called', () => {
    // Given
    const websocketServer = new WebSocketServer()
    const handler: any = {}
    const payloadStore: ExtensionsPayloadStore = {on: vi.fn()} as any
    const httpServer: Server = {on: vi.fn()} as any
    const options = {httpServer, payloadStore}
    vi.mocked(getPayloadUpdateHandler).mockReturnValue(handler)
    vi.useFakeTimers()

    // When
    setupWebsocketConnection(options).close()

    // Then
    expect(websocketServer.close).toHaveBeenCalled()
  })

  test('pings alive clients periodically to keep the connection alive', () => {
    // Given
    const handler: any = {}
    const payloadStore: ExtensionsPayloadStore = {on: vi.fn()} as any
    const httpServer: Server = {on: vi.fn()} as any
    const options = {httpServer, payloadStore}
    const client = {readyState: 1, ping: vi.fn()}
    WebSocketServer.prototype.clients = [client] as any

    vi.mocked(getPayloadUpdateHandler).mockReturnValue(handler)
    vi.useFakeTimers()

    // When
    setupWebsocketConnection(options)
    vi.advanceTimersToNextTimer()

    // Then
    expect(client.ping).toHaveBeenCalled()
  })

  test("doesn't ping disconnected clients periodically", () => {
    // Given
    const handler: any = {}
    const payloadStore: ExtensionsPayloadStore = {on: vi.fn()} as any
    const httpServer: Server = {on: vi.fn()} as any
    const options = {httpServer, payloadStore}
    const client = {readyState: 3, ping: vi.fn()}
    WebSocketServer.prototype.clients = [client] as any

    vi.mocked(getPayloadUpdateHandler).mockReturnValue(handler)
    vi.useFakeTimers()

    // When
    setupWebsocketConnection(options)
    vi.advanceTimersToNextTimer()

    // Then
    expect(client.ping).not.toHaveBeenCalled()
  })
})
