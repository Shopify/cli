import * as store from './extension/payload/store.js'
import * as server from './extension/server.js'
import * as websocket from './extension/websocket.js'
import {devUIExtensions, ExtensionDevOptions} from './extension.js'
import {ExtensionsEndpointPayload} from './extension/payload/models.js'
import {WebsocketConnection} from './extension/websocket/models.js'
import {AppEventWatcher} from './app-events/app-event-watcher.js'
import {testAppLinked} from '../../models/app/app.test-data.js'
import {describe, test, vi, expect} from 'vitest'
import {Server} from 'http'

describe('devUIExtensions()', () => {
  const serverCloseSpy = vi.fn()
  const websocketCloseSpy = vi.fn()
  const bundlerCloseSpy = vi.fn()
  const app = testAppLinked()

  const options = {
    mock: 'options',
    url: 'https://mock.url',
    signal: {addEventListener: vi.fn()},
    stdout: process.stdout,
    stderr: process.stderr,
    checkoutCartUrl: 'mock/path/from/extensions',
    appWatcher: new AppEventWatcher(app, 'url', 'path'),
  } as unknown as ExtensionDevOptions

  function spyOnEverything() {
    vi.spyOn(store, 'getExtensionsPayloadStoreRawPayload').mockResolvedValue({
      mock: 'payload',
    } as unknown as ExtensionsEndpointPayload)

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    vi.spyOn(store, 'ExtensionsPayloadStore').mockImplementation(() => ({mock: 'payload-store'}))
    vi.spyOn(server, 'setupHTTPServer').mockReturnValue({
      mock: 'http-server',
      close: serverCloseSpy,
    } as unknown as Server)
    vi.spyOn(websocket, 'setupWebsocketConnection').mockReturnValue({
      close: websocketCloseSpy,
    } as unknown as WebsocketConnection)
  }

  test('initializes the payload store', async () => {
    // GIVEN
    spyOnEverything()

    // WHEN
    await devUIExtensions(options)

    // THEN
    expect(store.ExtensionsPayloadStore).toHaveBeenCalledWith(
      {mock: 'payload'},
      {...options, websocketURL: 'wss://mock.url/extensions'},
    )
  })

  test('initializes the HTTP server', async () => {
    // GIVEN
    spyOnEverything()

    // WHEN
    await devUIExtensions(options)

    // THEN
    expect(server.setupHTTPServer).toHaveBeenCalledWith({
      devOptions: {...options, websocketURL: 'wss://mock.url/extensions'},
      payloadStore: {mock: 'payload-store'},
    })
  })

  test('initializes the websocket connection', async () => {
    // GIVEN
    spyOnEverything()

    // WHEN
    await devUIExtensions(options)

    // THEN
    expect(websocket.setupWebsocketConnection).toHaveBeenCalledWith({
      ...options,
      httpServer: expect.objectContaining({mock: 'http-server'}),
      payloadStore: {mock: 'payload-store'},
      websocketURL: 'wss://mock.url/extensions',
    })
  })

  test('closes the http server, websocket and bundler when the process aborts', async () => {
    // GIVEN
    spyOnEverything()

    // WHEN
    await devUIExtensions(options)

    // THEN
    expect(options.signal.addEventListener).toHaveBeenCalledWith('abort', expect.any(Function))

    const firstCallToAbort = vi.mocked(options.signal.addEventListener).mock.calls[0]!
    const [_event, abortEventCallback] = firstCallToAbort as [string, () => void]

    abortEventCallback()

    expect(websocketCloseSpy).toHaveBeenCalledOnce()
    expect(serverCloseSpy).toHaveBeenCalledOnce()
  })
})
