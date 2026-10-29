import {
  getConnectionDoneHandler,
  getOnMessageHandler,
  getPayloadUpdateHandler,
  handleLogEvent,
  parseLogMessage,
  websocketUpgradeHandler,
} from './handlers.js'
import {SetupWebSocketConnectionOptions} from './models.js'
import {ExtensionsEndpointPayload} from '../payload/models.js'
import {vi, describe, test, expect, Mock} from 'vitest'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import WebSocket, {RawData, WebSocketServer} from 'ws'
import colors from '@shopify/cli-kit/node/colors'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {createServer, IncomingMessage} from 'http'
import {EventEmitter} from 'events'
import {AddressInfo} from 'net'
import {Duplex} from 'stream'

vi.mock('@shopify/cli-kit/node/ui/components', () => ({
  useConcurrentOutputContext: vi.fn(),
}))

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
    stdout: {
      write: vi.fn(),
    },
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
  test('on client connection registers an error handler that logs the error without throwing', () => {
    const wss = getMockWebsocketServer()
    const options = getMockSetupWebSocketConnectionOptions()
    const ws = Object.assign(new EventEmitter(), {send: vi.fn()}) as unknown as WebSocket
    const output = mockAndCaptureOutput()

    getConnectionDoneHandler(wss, options)(ws)

    expect(() => ws.emit('error', new RangeError('Max payload size exceeded'))).not.toThrow()
    expect(output.debug()).toContain('Websocket connection error: Max payload size exceeded')
  })
  test('closes a client that sends an oversized frame and keeps notifying the other clients', async () => {
    const options = getMockSetupWebSocketConnectionOptions()
    const httpServer = createServer()
    const wss = new WebSocketServer({noServer: true, clientTracking: true, maxPayload: 1024})
    httpServer.on('upgrade', websocketUpgradeHandler(wss, options))
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
    const url = `ws://127.0.0.1:${(httpServer.address() as AddressInfo).port}/extensions`

    const connectClient = async () => {
      const client = new WebSocket(url)
      await new Promise((resolve) => client.once('message', resolve))
      return client
    }

    try {
      const listeningClient = await connectClient()
      const badClient = await connectClient()

      const badClientCloseCode = new Promise((resolve) => badClient.once('close', resolve))
      badClient.send('a'.repeat(2048))
      await expect(badClientCloseCode).resolves.toBe(1009)

      const dispatchingClient = await connectClient()
      const receivedDispatch = new Promise((resolve) => {
        listeningClient.once('message', (data: RawData) => resolve(JSON.parse(data.toString())))
      })
      dispatchingClient.send(JSON.stringify({event: 'dispatch', data: {type: 'focus'}}))

      await expect(receivedDispatch).resolves.toMatchObject({event: 'dispatch', data: {type: 'focus'}})

      listeningClient.terminate()
      dispatchingClient.terminate()
    } finally {
      wss.close()
      await new Promise((resolve) => httpServer.close(resolve))
    }
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

  test('on an incoming log event calls handleLogMessage and does not notify clients', () => {
    const wss = getMockWebsocketServer()
    const options = getMockSetupWebSocketConnectionOptions()
    const data = JSON.stringify({
      event: 'log',
      data: {
        type: 'info',
        message: 'Test log message',
        extensionName: 'test-extension',
      },
    }) as unknown as RawData

    getOnMessageHandler(wss, options)(data)

    // Verify useConcurrentOutputContext (any therefore handleLogMessage) was called with correct parameters
    expect(useConcurrentOutputContext).toHaveBeenCalledWith(
      {outputPrefix: 'test-extension', stripAnsi: false},
      expect.any(Function),
    )

    // Verify no client messages were sent since this was a log event
    wss.clients.forEach((ws) => expect(ws.send).not.toHaveBeenCalled())
  })
})

describe('parseLogMessage()', () => {
  test('parses and formats JSON array of strings', () => {
    const message = JSON.stringify(['Hello', 'world', 'test'], null, 2)
    const result = parseLogMessage(message)
    expect(result).toBe('Hello world test')
  })

  test('parses and formats JSON array with mixed types', () => {
    const message = JSON.stringify(['String', 42, true, null], null, 2)
    const result = parseLogMessage(message)
    expect(result).toBe('String 42 true null')
  })

  test('parses and formats JSON array with objects', () => {
    const object = {user: 'john', age: 30}
    const message = JSON.stringify(['Message:', object], null, 2)
    const result = parseLogMessage(message)
    expect(result).toBe(outputContent`Message: ${outputToken.json(object)}`.value)
  })

  test('returns original message when JSON parsing fails', () => {
    const invalidJson = 'This is not JSON'
    const result = parseLogMessage(invalidJson)
    expect(result).toBe('This is not JSON')
  })

  test('returns original message for JSON that is not an array', () => {
    const malformedJson = '{"invalid": json}'
    const result = parseLogMessage(malformedJson)
    expect(result).toBe('{"invalid": json}')
  })
})

describe('handleLogEvent()', () => {
  // Helper function to abstract the common expect pattern
  function expectLogMessageOutput(
    extensionName: string,
    expectedOutput: string,
    options: SetupWebSocketConnectionOptions,
  ) {
    expect(useConcurrentOutputContext).toHaveBeenCalledWith(
      {outputPrefix: extensionName, stripAnsi: false},
      expect.any(Function),
    )
    const contextCallback = (useConcurrentOutputContext as Mock).mock.calls[0]?.[1]
    contextCallback()

    expect(options.stdout.write).toHaveBeenCalledWith(expectedOutput)
  }

  test('outputs info level log message with correct formatting', () => {
    const options = getMockSetupWebSocketConnectionOptions()
    const eventData = {
      type: 'info',
      message: 'Test info message',
      extensionName: 'test-extension',
    }
    handleLogEvent(eventData, options)

    expectLogMessageOutput('test-extension', `Test info message`, options)
  })

  test('outputs log message with parsed JSON array', () => {
    const options = getMockSetupWebSocketConnectionOptions()
    const message = JSON.stringify(['Hello', 'world', {user: 'test'}], null, 2)
    const eventData = {
      type: 'info',
      message,
      extensionName: 'test-extension',
    }

    handleLogEvent(eventData, options)

    expectLogMessageOutput(
      'test-extension',
      outputContent`Hello world ${outputToken.json({user: 'test'})}`.value,
      options,
    )
  })

  test('outputs error level log message with error formatting', () => {
    const options = getMockSetupWebSocketConnectionOptions()
    const eventData = {
      type: 'error',
      message: 'Test error message',
      extensionName: 'error-extension',
    }

    handleLogEvent(eventData, options)

    expectLogMessageOutput('error-extension', `${colors.bold.redBright('ERROR')}: Test error message`, options)
  })

  test('handles unknown log type without erroring', () => {
    const options = getMockSetupWebSocketConnectionOptions()
    const eventData = {
      type: 'unknown-type',
      message: 'Message with unknown log type',
      extensionName: 'test-extension',
    }
    handleLogEvent(eventData, options)

    expectLogMessageOutput('test-extension', 'UNKNOWN-TYPE: Message with unknown log type', options)
  })
})
