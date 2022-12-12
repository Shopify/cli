import {ExtensionServerClient} from './ExtensionServerClient'
import {mockApp} from '../testing'
import WS from 'jest-websocket-mock'

const defaultOptions = {
  connection: {url: 'ws://example-host.com:8000/extensions/'},
}

describe('ExtensionServerClient', () => {
  function setup(options: ExtensionServer.Options = defaultOptions) {
    if (!options.connection.url) {
      throw new Error('Please set a URL')
    }
    const socket = new WS(options.connection.url, {jsonProtocol: true})
    const client = new ExtensionServerClient(options)

    return {socket, client, options}
  }

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

    test('sends data with extensions filtered by surface option on "update" event', async () => {
      const {socket, client} = setup({...defaultOptions, surface: 'admin'})
      const updateSpy = vi.fn()
      const data = {
        app: mockApp(),
        extensions: [
          {uuid: '123', surface: 'admin'},
          {uuid: '456', surface: 'checkout'},
          {uuid: '456', surface: '', extensionPoints: [{surface: 'admin'}]},
        ],
      }

      client.on('update', updateSpy)
      socket.send({event: 'update', data})

      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: [
            {uuid: '123', surface: 'admin'},
            {uuid: '456', surface: '', extensionPoints: [{surface: 'admin'}]},
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
