import {ExtensionServerClient} from './ExtensionServerClient'
import {mockApp} from '../testing'
import {beforeEach, expect, test, vi, describe} from 'vitest'

// Mock React's act function because jest-websocket-mock tries to use it
vi.mock('react-dom/test-utils', () => ({
  act: async (callback: () => Promise<void> | void) => {
    return callback()
  },
}))

// Create a custom mock WebSocket implementation to avoid using jest-websocket-mock
class MockWebSocketServer {
  clients: MockWebSocket[] = []
  messages: any[] = []

  connect(socket: MockWebSocket) {
    // OPEN state
    this.clients.push(socket)
    socket.readyState = 1
    socket.onopen?.({} as Event)
  }

  send(data: any) {
    this.messages.push(data)
    this.clients.forEach((client) => {
      const event = new MessageEvent('message', {
        data: typeof data === 'string' ? data : JSON.stringify(data),
      })
      client.onmessage?.(event)
    })
  }

  close() {
    // CLOSED state
    this.clients.forEach((client) => {
      client.readyState = 3
      client.onclose?.({} as CloseEvent)
    })
    this.clients = []
    this.messages = []
  }
}

class MockWebSocket implements Partial<WebSocket> {
  url: string
  readyState = 0
  onopen: ((ev: Event) => any) | null = null
  onmessage: ((ev: MessageEvent) => any) | null = null
  onclose: ((ev: CloseEvent) => any) | null = null
  server: MockWebSocketServer
  private eventListeners: {[key: string]: Set<EventListener>} = {
    open: new Set(),
    message: new Set(),
    close: new Set(),
    error: new Set(),
  }

  constructor(url: string, server: MockWebSocketServer) {
    this.url = url
    this.server = server
  }

  addEventListener(type: string, listener: EventListener): void {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = new Set()
    }
    this.eventListeners[type].add(listener)

    // Map standard event handlers to addEventListener
    if (type === 'open' && this.onopen === null) {
      this.onopen = (event) => {
        this.eventListeners.open.forEach((listener) => listener(event))
      }
    } else if (type === 'message' && this.onmessage === null) {
      this.onmessage = (event) => {
        this.eventListeners.message.forEach((listener) => listener(event))
      }
    } else if (type === 'close' && this.onclose === null) {
      this.onclose = (event) => {
        this.eventListeners.close.forEach((listener) => listener(event))
      }
    }
  }

  removeEventListener(type: string, listener: EventListener): void {
    if (this.eventListeners[type]) {
      this.eventListeners[type].delete(listener)
    }
  }

  dispatchEvent(event: Event): boolean {
    const type = event.type

    if (type === 'open' && this.onopen) {
      this.onopen(event)
    } else if (type === 'message' && this.onmessage) {
      this.onmessage(event as MessageEvent)
    } else if (type === 'close' && this.onclose) {
      this.onclose(event as CloseEvent)
    }

    if (this.eventListeners[type]) {
      this.eventListeners[type].forEach((listener) => listener(event))
    }

    return true
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    this.server.messages.push(data)
  }

  close() {
    this.readyState = 3
    this.onclose?.({} as CloseEvent)
  }
}

// Update the connection interface to include automaticConnect
declare module './ExtensionServerClient' {
  namespace ExtensionServer {
    interface ConnectionOptions {
      url?: string
      automaticConnect?: boolean
    }
  }
}

// Test constants
const TEST_CONNECTION_URL = 'ws://example-host.com:8000/extensions/'

const defaultOptions = {
  connection: {
    url: TEST_CONNECTION_URL,
    automaticConnect: true,
  },
}

describe('ExtensionServerClient', () => {
  let mockSocketServer: MockWebSocketServer
  let mockSocket: MockWebSocket

  // Create a WebSocket factory function that returns our mock
  const createMockWebSocket = (url: string) => {
    mockSocket = new MockWebSocket(url, mockSocketServer)
    return mockSocket
  }

  beforeEach(() => {
    // Set up mock socket server
    mockSocketServer = new MockWebSocketServer()

    // Mock the global WebSocket to use our implementation
    vi.spyOn(globalThis, 'WebSocket').mockImplementation(function (urlParam: any) {
      // Handle both string URLs and URL objects by extracting the string representation
      const urlString = typeof urlParam === 'string' ? urlParam : urlParam.toString()
      return createMockWebSocket(urlString) as unknown as WebSocket
    })
  })

  describe('initialization', () => {
    test('connects to the target websocket', async () => {
      // Create client
      const client = new ExtensionServerClient(defaultOptions)

      // Connect the mock socket to simulate WebSocket connection
      mockSocketServer.connect(mockSocket)

      // Verify connection is established
      expect(client.connection).toBeDefined()
      expect(mockSocketServer.clients.length).toBe(1)
    })

    test('does not connect to the target websocket if "automaticConnect" is false', async () => {
      // Create client with automaticConnect: false
      const client = new ExtensionServerClient({
        connection: {
          url: TEST_CONNECTION_URL,
          automaticConnect: false,
        },
      })

      // Verify connection is not established
      expect(client.connection).toBeUndefined()
      expect(mockSocketServer.clients.length).toBe(0)
    })
  })

  describe('on()', () => {
    test('sends data with extensions filtered by surface option on "connected" event', async () => {
      // Create client
      const client = new ExtensionServerClient({
        connection: {
          url: TEST_CONNECTION_URL,
          automaticConnect: true,
        },
        surface: 'admin',
      })

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Create spy for the connected event
      const connectSpy = vi.fn()
      client.on('connected', connectSpy)

      // Send connected event with mock data
      const data = {
        app: mockApp(),
        extensions: [
          {uuid: '123', surface: 'admin'},
          {uuid: '456', surface: 'checkout'},
          {uuid: '789', surface: '', extensionPoints: [{surface: 'admin'}]},
        ],
      }

      // Send the event
      mockSocketServer.send({event: 'connected', data})

      // Verify correct data is filtered and passed to the callback
      expect(connectSpy).toHaveBeenCalledTimes(1)
      expect(connectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: expect.arrayContaining([
            expect.objectContaining({uuid: '123', surface: 'admin'}),
            expect.objectContaining({uuid: '789'}),
          ]),
        }),
      )
      // Verify checkout extension is filtered out
      const calledWith = connectSpy.mock.calls[0][0]
      const extensionIds = calledWith.extensions.map((ext: any) => ext.uuid)
      expect(extensionIds).not.toContain('456')
    })
  })

  describe('emit()', () => {
    test('emits an event', async () => {
      // Create client
      const client = new ExtensionServerClient(defaultOptions)

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Emit an event
      client.emit('unfocus')

      // Verify the correct message was sent
      expect(mockSocketServer.messages.length).toBe(1)

      // Parse the JSON if it's a string
      const message =
        typeof mockSocketServer.messages[0] === 'string'
          ? JSON.parse(mockSocketServer.messages[0])
          : mockSocketServer.messages[0]

      expect(message).toMatchObject({
        event: 'dispatch',
        data: {type: 'unfocus'},
      })
    })
  })

  describe('persist()', () => {
    test('persists a mutation', async () => {
      // Create client
      const client = new ExtensionServerClient(defaultOptions)

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Persist data
      const extensionData = {extensions: [{uuid: '123'}]}
      client.persist('update', extensionData)

      // Verify the correct message was sent
      expect(mockSocketServer.messages.length).toBe(1)

      // Parse the JSON if it's a string
      const message =
        typeof mockSocketServer.messages[0] === 'string'
          ? JSON.parse(mockSocketServer.messages[0])
          : mockSocketServer.messages[0]

      expect(message).toMatchObject({
        event: 'update',
        data: extensionData,
      })
    })
  })

  describe('connect()', () => {
    test('updates the client options', () => {
      // Create client without initial options
      const client = new ExtensionServerClient()

      // Then connect with options
      client.connect({connection: {automaticConnect: false}})

      // Verify options were updated
      expect(client.options.connection).toMatchObject({
        automaticConnect: false,
      })
    })
  })
})
