import {
  getConnectionDoneHandler,
  getOnMessageHandler,
  getPayloadUpdateHandler,
  websocketUpgradeHandler,
} from './handlers.js'
import {SetupWebSocketConnectionOptions} from './models.js'
import {ExtensionsEndpointPayload} from '../payload/models.js'
import {vi, describe, test, expect} from 'vitest'
import WebSocket, {RawData, WebSocketServer} from 'ws'
import {IncomingMessage} from 'h3'
import {Duplex} from 'stream'

function getMockRequest() {
  const request = {
    url: '/extensions',
  }

  return request as unknown as IncomingMessage
}

function getMockSocket() {
  return {} as unknown as Duplex
}

function getMockHead() {
  return {} as unknown as Buffer
}

function getMockWebsocket() {
  return {
    send: vi.fn(),
    on: vi.fn(),
  } as unknown as WebSocket
}

function getMockWebsocketServer() {
  return {
    clients: [{send: vi.fn()}],
    handleUpgrade: vi.fn(),
  } as unknown as WebSocketServer
}

const extensionPayload = {} as unknown as ExtensionsEndpointPayload

function getMockSetupWebSocketConnectionOptions() {
  return {
    payloadStore: {
      getRawPayloadFilteredByExtensionIds: vi.fn((extensionIds: string[]) => extensionPayload),
      getConnectedPayload: vi.fn(() => {
        return {app: {appId: 'Test app'}, store: 'test.store', extensions: []}
      }),
      getRawPayload: vi.fn(() => {
        return {app: {appId: 'Test app', apiKey: 'test-app-api-key'}, store: 'test.store'}
      }),
      updateApp: vi.fn(),
      updateExtensions: vi.fn(),
    },
    manifestVersion: '3',
  } as unknown as SetupWebSocketConnectionOptions
}

describe('getPayloadUpdateHandler()', () => {
  test('sends a websocket message to all clients containing the extension payloads filtered', () => {
    const wss = getMockWebsocketServer()
    const options = getMockSetupWebSocketConnectionOptions()
    getPayloadUpdateHandler(wss, options)(['test_extension_1'])

    expect(options.payloadStore.getRawPayloadFilteredByExtensionIds).toHaveBeenCalledWith(['test_extension_1'])
    wss.clients.forEach((ws) => expect(ws.send).toHaveBeenCalledWith('{"event":"update","version":"3","data":{}}'))
  })
})

describe('websocketUpgradeHandler()', () => {
  test('on an upgrade request with path `/extension` passes the getConnectionDoneHandler() to handlerUpgrade', () => {
    const wss = getMockWebsocketServer()
    const options = getMockSetupWebSocketConnectionOptions()
    const request = getMockRequest()
    const socket = getMockSocket()
    const head = getMockHead()
    websocketUpgradeHandler(wss, options)(request, socket, head)

    expect(wss.handleUpgrade).toHaveBeenCalledWith(request, socket, head, expect.anything())
  })
})

describe('getConnectionDoneHandler()', () => {
  test('on client connection sends a connected message', () => {
    const wss = getMockWebsocketServer()
    const options = getMockSetupWebSocketConnectionOptions()
    const ws = getMockWebsocket()
    getConnectionDoneHandler(wss, options)(ws)
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'connected',
        data: options.payloadStore.getConnectedPayload(),
        version: '3',
      }),
    )
  })
  test('on client connection registers a message handler for incomming messages', () => {
    const wss = getMockWebsocketServer()
    const options = getMockSetupWebSocketConnectionOptions()
    const ws = getMockWebsocket()
    getConnectionDoneHandler(wss, options)(ws)
    expect(ws.on).toHaveBeenCalledWith('message', expect.anything())
  })
})
describe('getOnMessageHandler()', () => {
  test('on an incomming update message updates the app and the extensions', () => {
    const wss = getMockWebsocketServer()
    const options = getMockSetupWebSocketConnectionOptions()
    const eventApp = {apiKey: 'test-app-api-key'}
    const data = JSON.stringify({
      event: 'update',
      data: {
        app: eventApp,
        extensions: [],
      },
    }) as unknown as RawData
    getOnMessageHandler(wss, options)(data)

    expect(options.payloadStore.updateApp).toHaveBeenCalledWith(eventApp)
    expect(options.payloadStore.updateExtensions).toHaveBeenCalledWith([])
  })
  test("on an incoming update message doesn't update the app if the API keys don't match", () => {
    const wss = getMockWebsocketServer()
    const options = getMockSetupWebSocketConnectionOptions()
    const data = JSON.stringify({
      event: 'update',
      data: {
        app: {
          apiKey: 'other-api-key',
        },
        extensions: [],
      },
    }) as unknown as RawData
    getOnMessageHandler(wss, options)(data)

    expect(options.payloadStore.updateApp).not.toHaveBeenCalled()
  })
  test("on an incoming update message doesn't update the extensions if the API keys don't match", () => {
    const wss = getMockWebsocketServer()
    const options = getMockSetupWebSocketConnectionOptions()
    const data = JSON.stringify({
      event: 'update',
      data: {
        app: {
          apiKey: 'other-api-key',
        },
        extensions: [],
      },
    }) as unknown as RawData
    getOnMessageHandler(wss, options)(data)

    expect(options.payloadStore.updateExtensions).not.toHaveBeenCalled()
  })
  test('on an incomming dispatch notify clients', () => {
    const wss = getMockWebsocketServer()
    const options = getMockSetupWebSocketConnectionOptions()
    const data = JSON.stringify({
      event: 'dispatch',
      data: {
        type: 'focus',
        extensions: [],
        app: {},
      },
    }) as unknown as RawData
    getOnMessageHandler(wss, options)(data)

    expect(options.payloadStore.updateApp).not.toHaveBeenCalled()
    expect(options.payloadStore.updateExtensions).not.toHaveBeenCalled()

    const outgoingMessage = JSON.stringify({
      event: 'dispatch',
      data: {
        type: 'focus',
        extensions: [],
        app: {appId: 'Test app', apiKey: 'test-app-api-key'},
        store: 'test.store',
      },
      version: '3',
    }) as unknown as RawData
    wss.clients.forEach((ws) => expect(ws.send).toHaveBeenCalledWith(outgoingMessage))
  })
})
