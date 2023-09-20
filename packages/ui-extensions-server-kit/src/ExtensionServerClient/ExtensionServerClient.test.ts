import {ExtensionServerClient} from './ExtensionServerClient'
import {mockApp} from '../testing'
import WS from 'jest-websocket-mock'
import {Localization} from 'i18n.js'

const defaultOptions = {
  connection: {url: 'ws://example-host.com:8000/extensions/'},
}

describe('ExtensionServerClient', () => {
  let socket: WS

  function setup(options: ExtensionServer.Options = defaultOptions) {
    if (!options.connection.url) {
      throw new Error('Please set a URL')
    }
    socket = new WS(options.connection.url, {jsonProtocol: true})
    const client = new ExtensionServerClient(options)

    return {socket, client, options}
  }

  afterEach(() => {
    socket.close()
  })

  describe('initialization', () => {
    test('connects to the target websocket', async () => {
      const {socket, client} = setup()

      expect(client.connection).toBeDefined()
      expect(socket.server.clients()).toHaveLength(1)

      socket.close()
    })

    test('does not connect to the target websocket if "automaticConnect" is false', async () => {
      const {client, socket} = setup({
        connection: {automaticConnect: false, url: 'ws://example-host.com:8000/extensions/'},
      })

      expect(client.connection).toBeUndefined()
      expect(socket.server.clients()).toHaveLength(0)

      socket.close()
    })
  })

  describe('on()', () => {
    test('sends data with extensions filtered by surface option on "connected" event', async () => {
      const {socket, client} = setup({...defaultOptions, surface: 'admin'})
      const connectSpy = vi.fn()
      const data = {
        app: mockApp(),
        extensions: [
          {uuid: '123', surface: 'admin'},
          {uuid: '456', surface: 'checkout'},
          {uuid: '456', surface: '', extensionPoints: [{surface: 'admin'}]},
        ],
      }

      client.on('connected', connectSpy)
      socket.send({event: 'connected', data})

      expect(connectSpy).toHaveBeenCalledTimes(1)
      expect(connectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: [
            {uuid: '123', surface: 'admin'},
            {uuid: '456', surface: '', extensionPoints: [{surface: 'admin'}]},
          ],
        }),
      )

      socket.close()
    })

    test('sends data with all extensions when surface option is not valid on "connected" event', async () => {
      const {socket, client} = setup({...defaultOptions, surface: 'abc' as any})
      const connectSpy = vi.fn()
      const data = {
        app: mockApp(),
        extensions: [
          {uuid: '123', surface: 'admin'},
          {uuid: '456', surface: 'checkout'},
        ],
      }

      client.on('connected', connectSpy)
      socket.send({event: 'connected', data})

      expect(connectSpy).toHaveBeenCalledTimes(1)
      expect(connectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: data.extensions,
        }),
      )

      socket.close()
    })

    test('sends data with translatable props as-is for UI extensions when locales option is not provided on "connected" event', async () => {
      const {socket, client} = setup()
      const connectSpy = vi.fn()
      const localization: Localization = {
        defaultLocale: 'en',
        translations: {
          ja: {
            welcome: 'いらっしゃいませ!',
          },
          en: {
            welcome: 'Welcome!',
          },
          fr: {
            welcome: 'Bienvenue!',
          },
        },
        lastUpdated: 1684164163736,
      }

      const data = {
        app: mockApp(),
        extensions: [
          {
            uuid: '123',
            type: 'ui_extension',
            localization,
            extensionPoints: [{localization}],
          },
          {uuid: '456', type: 'ui_extension', localization: null, extensionPoints: [{localization: null}]},
          {uuid: '789', type: 'product_subscription'},
        ],
      }

      client.on('connected', connectSpy)
      socket.send({event: 'connected', data})

      expect(connectSpy).toHaveBeenCalledTimes(1)
      expect(connectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: data.extensions,
        }),
      )

      socket.close()
    })

    test('sends data with translated props for UI extensions when locales option is provided on "connected" event', async () => {
      const {socket, client} = setup({...defaultOptions, locales: {user: 'ja', shop: 'fr'}})
      const connectSpy = vi.fn()
      const localization: Localization = {
        defaultLocale: 'en',
        translations: {
          ja: {
            welcome: 'いらっしゃいませ!',
            description: '拡張子の説明',
          },
          en: {
            welcome: 'Welcome!',
            description: 'Extension description',
          },
          fr: {
            welcome: 'Bienvenue!',
            description: "Description de l'extension",
          },
        },
        lastUpdated: 1684164163736,
      }

      const translatedLocalization = {
        extensionLocale: 'ja',
        translations: '{"welcome":"いらっしゃいませ!","description":"拡張子の説明"}',
        lastUpdated: localization.lastUpdated,
      }

      const data = {
        app: mockApp(),
        extensions: [
          {
            uuid: '123',
            type: 'ui_extension',
            name: 't:welcome',
            description: 't:description',
            localization,
            extensionPoints: [{localization}],
          },
          {
            uuid: '456',
            type: 'ui_extension',
            name: 'Fixed name t:',
            localization: null,
            extensionPoints: [{localization: null, name: 'Fixed name t:'}],
          },
          {uuid: '789', type: 'product_subscription', name: 'Extension 789'},
        ],
      }

      client.on('connected', connectSpy)
      socket.send({event: 'connected', data})

      expect(connectSpy).toHaveBeenCalledTimes(1)
      expect(connectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: [
            {
              uuid: '123',
              type: 'ui_extension',
              name: 'いらっしゃいませ!',
              description: '拡張子の説明',
              localization: translatedLocalization,
              extensionPoints: [
                {
                  localization: translatedLocalization,
                  name: 'いらっしゃいませ!',
                  description: '拡張子の説明',
                },
              ],
            },
            {
              uuid: '456',
              type: 'ui_extension',
              name: 'Fixed name t:',
              localization: null,
              extensionPoints: [{localization: null, name: 'Fixed name t:'}],
            },
            {uuid: '789', type: 'product_subscription', name: 'Extension 789'},
          ],
        }),
      )

      socket.close()
    })

    test('sends data with extensions filtered by surface option on "update" event', async () => {
      const {socket, client} = setup({...defaultOptions, surface: 'admin'})
      const updateSpy = vi.fn()
      const data = {
        app: mockApp(),
        extensions: [
          {uuid: '123', surface: 'admin'},
          {uuid: '456', surface: 'checkout'},
          {uuid: '789', surface: '', extensionPoints: [{surface: 'admin'}]},
        ],
      }

      client.on('update', updateSpy)
      socket.send({event: 'update', data})

      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: [
            {uuid: '123', surface: 'admin'},
            {uuid: '789', surface: '', extensionPoints: [{surface: 'admin'}]},
          ],
        }),
      )

      socket.close()
    })

    test('sends data with all extensions when surface option is not valid on "update" event', async () => {
      const {socket, client} = setup({...defaultOptions, surface: 'abc' as any})
      const updateSpy = vi.fn()
      const data = {
        app: mockApp(),
        extensions: [
          {uuid: '123', surface: 'admin'},
          {uuid: '456', surface: 'checkout'},
        ],
      }

      client.on('update', updateSpy)
      socket.send({event: 'update', data})

      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: data.extensions,
        }),
      )

      socket.close()
    })

    test('sends data with translatable props as-is when locales option is not provided on "update" event', async () => {
      const {socket, client} = setup()
      const updateSpy = vi.fn()
      const localization: Localization = {
        defaultLocale: 'en',
        translations: {
          ja: {
            welcome: 'いらっしゃいませ!',
            description: '拡張子の説明',
          },
          en: {
            welcome: 'Welcome!',
            description: 'Extension description',
          },
          fr: {
            welcome: 'Bienvenue!',
            description: "Description de l'extension",
          },
        },
        lastUpdated: 1684164163736,
      }

      const data = {
        app: mockApp(),
        extensions: [
          {
            uuid: '123',
            type: 'ui_extension',
            name: 't:welcome',
            description: 't:description',
            localization,
            extensionPoints: [{localization}],
          },
          {
            uuid: '456',
            type: 'ui_extension',
            name: 'Extension 456',
            localization: null,
            extensionPoints: [{localization: null}],
          },
          {uuid: '789', type: 'product_subscription'},
        ],
      }

      client.on('update', updateSpy)
      socket.send({event: 'update', data})

      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: data.extensions,
        }),
      )

      socket.close()
    })

    test('sends data with translated props when locales option is provided on "update" event', async () => {
      const {socket, client} = setup({...defaultOptions, locales: {user: 'ja', shop: 'fr'}})
      const updateSpy = vi.fn()
      const localization: Localization = {
        defaultLocale: 'en',
        translations: {
          ja: {
            welcome: 'いらっしゃいませ!',
            description: '拡張子の説明',
          },
          en: {
            welcome: 'Welcome!',
            description: 'Extension description',
          },
          fr: {
            welcome: 'Bienvenue!',
            description: "Description de l'extension",
          },
        },
        lastUpdated: 1684164163736,
      }

      const translatedLocalization = {
        extensionLocale: 'ja',
        translations: '{"welcome":"いらっしゃいませ!","description":"拡張子の説明"}',
        lastUpdated: localization.lastUpdated,
      }

      const data = {
        app: mockApp(),
        extensions: [
          {
            uuid: '123',
            type: 'ui_extension',
            name: 't:welcome',
            description: 't:description',
            localization,
            extensionPoints: [{localization}],
          },
          {
            uuid: '456',
            type: 'ui_extension',
            name: 'Extension 456',
            description: 'This is a test extension',
            localization: null,
            extensionPoints: [{localization: null}],
          },
          {uuid: '789', name: 'Extension 789', type: 'product_subscription'},
        ],
      }

      client.on('update', updateSpy)
      socket.send({event: 'update', data})

      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: [
            {
              uuid: '123',
              type: 'ui_extension',
              name: 'いらっしゃいませ!',
              description: '拡張子の説明',
              localization: translatedLocalization,
              extensionPoints: [
                {localization: translatedLocalization, name: 'いらっしゃいませ!', description: '拡張子の説明'},
              ],
            },
            {
              uuid: '456',
              type: 'ui_extension',
              name: 'Extension 456',
              description: 'This is a test extension',
              localization: null,
              extensionPoints: [{localization: null}],
            },
            {uuid: '789', type: 'product_subscription', name: 'Extension 789'},
          ],
        }),
      )

      socket.close()
    })

    test('sends data with translated props when locales option is provided on subsequent "update" events', async () => {
      const {socket, client} = setup({...defaultOptions, locales: {user: 'ja', shop: 'fr'}})
      const updateSpy = vi.fn()
      const localization: Localization = {
        defaultLocale: 'en',
        translations: {
          ja: {
            welcome: 'いらっしゃいませ!',
            description: '拡張子の説明',
          },
          en: {
            welcome: 'Welcome!',
            description: 'Extension description',
          },
          fr: {
            welcome: 'Bienvenue!',
            description: "Description de l'extension",
          },
        },
        lastUpdated: 1684164163736,
      }

      const translatedLocalization = {
        extensionLocale: 'ja',
        translations: '{"welcome":"いらっしゃいませ!","description":"拡張子の説明"}',
        lastUpdated: localization.lastUpdated,
      }

      const data = {
        app: mockApp(),
        extensions: [
          {
            uuid: '123',
            type: 'ui_extension',
            name: 't:welcome',
            description: 't:description',
            localization,
            extensionPoints: [{localization}],
          },
          {
            uuid: '456',
            type: 'ui_extension',
            name: 'Extension 456',
            description: 'This is a test extension',
            localization: null,
            extensionPoints: [{localization: null}],
          },
          {uuid: '789', type: 'product_subscription', name: 'Extension 789'},
        ],
      }

      client.on('update', updateSpy)
      socket.send({event: 'update', data})
      socket.send({event: 'update', data})

      expect(updateSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          extensions: [
            {
              uuid: '123',
              type: 'ui_extension',
              name: 'いらっしゃいませ!',
              description: '拡張子の説明',
              localization: translatedLocalization,
              extensionPoints: [
                {localization: translatedLocalization, name: 'いらっしゃいませ!', description: '拡張子の説明'},
              ],
            },
            {
              uuid: '456',
              type: 'ui_extension',
              name: 'Extension 456',
              description: 'This is a test extension',
              localization: null,
              extensionPoints: [{localization: null}],
            },
            {uuid: '789', type: 'product_subscription', name: 'Extension 789'},
          ],
        }),
      )

      socket.close()
    })

    test('listens to persist events', async () => {
      const {socket, client} = setup()
      const updateSpy = vi.fn()
      const data = {
        app: mockApp(),
      }

      client.on('update', updateSpy)
      socket.send({event: 'update', data})

      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledWith(data)

      socket.close()
    })

    test('unsubscribes from persist events', async () => {
      const {socket, client} = setup()
      const updateSpy = vi.fn()
      const unsubscribe = client.on('update', updateSpy)

      unsubscribe()
      socket.send({
        event: 'update',
        data: {
          app: mockApp(),
        },
      })

      expect(updateSpy).toHaveBeenCalledTimes(0)

      socket.close()
    })

    test('listens to dispatch events', async () => {
      const {socket, client} = setup()
      const unfocusSpy = vi.fn()

      client.on('unfocus', unfocusSpy)
      socket.send({event: 'dispatch', data: {type: 'unfocus'}})

      expect(unfocusSpy).toHaveBeenCalledTimes(1)
      expect(unfocusSpy).toHaveBeenCalledWith(undefined)

      socket.close()
    })
  })

  describe('emit()', () => {
    test('emits an event', async () => {
      const {socket, client} = setup()
      const data = {data: {type: 'unfocus'}, event: 'dispatch'}

      client.emit('unfocus')

      await expect(socket).toReceiveMessage(data)

      socket.close()
    })

    test('warns if trying to "emit" a persist event', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const {socket, client} = setup()

      client.emit('update' as any, {})

      expect(warnSpy).toHaveBeenCalled()

      socket.close()
      warnSpy.mockRestore()
    })
  })

  describe('persist()', () => {
    test('persists a mutation', async () => {
      const {socket, client} = setup()
      const data = {event: 'update', data: {extensions: [{uuid: '123'}]}}

      client.persist('update', {extensions: [{uuid: '123'}]})

      await expect(socket).toReceiveMessage(data)

      socket.close()
    })

    test('warns if trying to "persist" a dispatch event', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const {socket, client} = setup()

      client.persist('unfocus' as any, {})

      expect(warnSpy).toHaveBeenCalled()

      socket.close()
      warnSpy.mockRestore()
    })

    test('remove translated props from the UI extensions payload when locales are provided in the client options', async () => {
      const {socket, client} = setup({connection: defaultOptions.connection, locales: {user: 'ja', shop: 'fr'}})
      const data = {
        event: 'update',
        data: {
          extensions: [{uuid: '123', type: 'ui_extension', extensionPoints: [{}]}],
        },
      }

      client.persist('update', {
        extensions: [
          {
            uuid: '123',
            type: 'ui_extension',
            name: 'いらっしゃいませ!',
            description: '拡張子の説明',
            localization: {},
            extensionPoints: [{localization: {}, name: 'いらっしゃいませ!', description: '拡張子の説明'}],
          },
        ],
      })

      await expect(socket).toReceiveMessage(data)

      socket.close()
    })

    test('leave translatable props as-is in the UI extensions payload when locales are not provided in the client options', async () => {
      const {socket, client} = setup()
      const data = {
        event: 'update',
        data: {
          extensions: [{uuid: '123', type: 'ui_extension', localization: {}, extensionPoints: [{localization: {}}]}],
        },
      }

      client.persist('update', {
        extensions: [{uuid: '123', type: 'ui_extension', localization: {}, extensionPoints: [{localization: {}}]}],
      })

      await expect(socket).toReceiveMessage(data)

      socket.close()
    })
  })

  describe('connect()', () => {
    test('updates the client options', () => {
      const client = new ExtensionServerClient()

      client.connect({connection: {automaticConnect: false}})

      expect(client.options).toMatchObject({
        connection: {
          automaticConnect: false,
          protocols: [],
        },
      })
    })

    test('does not attempt to connect if the URL is undefined', () => {
      const client = new ExtensionServerClient()

      client.connect()

      expect(client.connection).toBeUndefined()
    })

    test('does not attempt to connect if the URL is empty', () => {
      const client = new ExtensionServerClient({connection: {url: ''}})

      client.connect()

      expect(client.connection).toBeUndefined()
    })

    test('re-use existing connection if connect options have not changed', async () => {
      const initialURL = 'ws://initial.socket.com'
      const initialSocket = new WS(initialURL)
      const client = new ExtensionServerClient({connection: {url: initialURL}})

      vi.spyOn(initialSocket, 'close')

      await initialSocket.connected

      expect(initialSocket.server.clients()).toHaveLength(1)

      client.connect({connection: {url: initialURL}})

      expect(initialSocket.server.clients()).toHaveLength(1)
      expect(initialSocket.close).not.toHaveBeenCalled()

      initialSocket.close()
    })

    test('creates a new connection if the URL has changed', async () => {
      const initialURL = 'ws://initial.socket.com'
      const initialSocket = new WS(initialURL)
      const updatedURL = 'ws://updated.socket.com'
      const updatedSocket = new WS(updatedURL)
      const client = new ExtensionServerClient({connection: {url: initialURL}})

      await initialSocket.connected

      expect(initialSocket.server.clients()).toHaveLength(1)
      expect(updatedSocket.server.clients()).toHaveLength(0)

      client.connect({connection: {url: updatedURL}})

      await initialSocket.closed

      expect(initialSocket.server.clients()).toHaveLength(0)
      expect(updatedSocket.server.clients()).toHaveLength(1)

      initialSocket.close()
      updatedSocket.close()
    })
  })
})
