import * as store from './extension/payload/store.js'
import * as server from './extension/server.js'
import * as websocket from './extension/websocket.js'
import {devUIExtensions, ExtensionDevOptions, resolveAppAssets} from './extension.js'
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
    extensions: [{type: 'ui_extension', devUUID: 'FOO', isPreviewable: true}],
  } as unknown as ExtensionDevOptions

  function spyOnEverything() {
    vi.spyOn(store, 'getExtensionsPayloadStoreRawPayload').mockResolvedValue({
      mock: 'payload',
    } as unknown as ExtensionsEndpointPayload)

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    vi.spyOn(store, 'ExtensionsPayloadStore').mockImplementation(() => ({
      mock: 'payload-store',
      updateAppAssets: vi.fn(),
    }))
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
    expect(server.setupHTTPServer).toHaveBeenCalledWith(
      expect.objectContaining({
        devOptions: expect.objectContaining({websocketURL: 'wss://mock.url/extensions'}),
        payloadStore: expect.objectContaining({mock: 'payload-store'}),
        getExtensions: expect.any(Function),
      }),
    )
  })

  test('initializes the HTTP server with a getExtensions function that returns the extensions from the provided options', async () => {
    // GIVEN
    spyOnEverything()

    // WHEN
    await devUIExtensions(options)

    const {getExtensions} = vi.mocked(server.setupHTTPServer).mock.calls[0]![0]
    expect(getExtensions()).toStrictEqual(options.extensions)
  })

  test('initializes the websocket connection', async () => {
    // GIVEN
    spyOnEverything()

    // WHEN
    await devUIExtensions(options)

    // THEN
    expect(websocket.setupWebsocketConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        httpServer: expect.objectContaining({mock: 'http-server'}),
        payloadStore: expect.objectContaining({mock: 'payload-store'}),
        websocketURL: 'wss://mock.url/extensions',
      }),
    )
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

  test('updates the extensions returned by the getExtensions with new previewable extensions when the app is reloaded', async () => {
    // GIVEN
    spyOnEverything()

    // WHEN
    await devUIExtensions(options)

    const {getExtensions} = vi.mocked(server.setupHTTPServer).mock.calls[0]![0]
    expect(getExtensions()).toStrictEqual(options.extensions)

    const newUIExtension = {
      type: 'ui_extension',
      devUUID: 'BAR',
      isPreviewable: true,
      specification: {identifier: 'ui_extension'},
    }
    const newApp = {
      ...app,
      allExtensions: [
        newUIExtension,
        {
          type: 'function_extension',
          devUUID: 'FUNCTION',
          isPreviewable: false,
          specification: {identifier: 'function'},
        },
      ],
    }
    options.appWatcher.emit('all', {app: newApp, appWasReloaded: true, extensionEvents: []})

    // THEN
    expect(getExtensions()).toStrictEqual([newUIExtension])
  })

  test('passes getAppAssets callback to the HTTP server when appAssets provided', async () => {
    // GIVEN
    spyOnEverything()
    const optionsWithAssets = {
      ...options,
      appAssets: {staticRoot: '/absolute/path/to/public'},
    } as unknown as ExtensionDevOptions

    // WHEN
    await devUIExtensions(optionsWithAssets)

    // THEN
    expect(server.setupHTTPServer).toHaveBeenCalledWith(
      expect.objectContaining({
        getAppAssets: expect.any(Function),
      }),
    )

    const {getAppAssets} = vi.mocked(server.setupHTTPServer).mock.calls[0]![0]
    expect(getAppAssets!()).toStrictEqual({staticRoot: '/absolute/path/to/public'})
  })
})

describe('resolveAppAssets()', () => {
  test('returns empty object when no admin extension exists', () => {
    const extensions = [
      {specification: {identifier: 'ui_extension'}, configuration: {}, directory: '/app'},
    ] as unknown as Parameters<typeof resolveAppAssets>[0]

    expect(resolveAppAssets(extensions)).toStrictEqual({})
  })

  test('returns empty object when admin extension has no static_root', () => {
    const extensions = [
      {specification: {identifier: 'admin'}, configuration: {admin: {}}, directory: '/app/extensions/admin'},
    ] as unknown as Parameters<typeof resolveAppAssets>[0]

    expect(resolveAppAssets(extensions)).toStrictEqual({})
  })

  test('returns staticRoot mapped to resolved absolute path when static_root is set', () => {
    const extensions = [
      {
        specification: {identifier: 'admin'},
        configuration: {admin: {static_root: 'public'}},
        directory: '/app/extensions/admin',
      },
    ] as unknown as Parameters<typeof resolveAppAssets>[0]

    const result = resolveAppAssets(extensions)

    expect(result).toStrictEqual({
      staticRoot: '/app/extensions/admin/public',
    })
  })
})
