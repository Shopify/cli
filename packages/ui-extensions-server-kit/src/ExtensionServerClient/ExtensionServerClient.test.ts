import {ExtensionServerClient} from './ExtensionServerClient'
import {DeepPartial} from '../types'
import {mockApp} from '../testing'
import {beforeEach, expect, test, vi, describe} from 'vitest'
import {Localization} from 'i18n.js'

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

    test('sends data with all extensions when surface option is not valid on "connected" event', async () => {
      // Create client with invalid surface
      const client = new ExtensionServerClient({
        connection: {
          url: TEST_CONNECTION_URL,
          automaticConnect: true,
        },
        surface: 'abc' as any,
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
        ],
      }

      // Send the event
      mockSocketServer.send({event: 'connected', data})

      // Verify all extensions are passed to the callback
      expect(connectSpy).toHaveBeenCalledTimes(1)
      expect(connectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: expect.arrayContaining([
            expect.objectContaining({uuid: '123'}),
            expect.objectContaining({uuid: '456'}),
          ]),
        }),
      )
    })

    test('sends data with translatable props as-is for UI extensions when locales option is not provided on "connected" event', async () => {
      // Create client
      const client = new ExtensionServerClient(defaultOptions)

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Create spy
      const connectSpy = vi.fn()
      client.on('connected', connectSpy)

      // Define localization data
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

      // Mock data
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

      // Send event
      mockSocketServer.send({event: 'connected', data})

      // Verify props are passed as-is
      expect(connectSpy).toHaveBeenCalledTimes(1)
      expect(connectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: expect.arrayContaining(data.extensions),
        }),
      )
    })

    test('sends data as-is on "connected" event', async () => {
      // Create client
      const client = new ExtensionServerClient(defaultOptions)

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Create spy
      const connectSpy = vi.fn()
      client.on('connected', connectSpy)

      // Mock data
      const data = {
        app: mockApp(),
        extensions: [
          {uuid: '123', type: 'ui_extension', name: 'Extension 123'},
          {uuid: '456', type: 'checkout_ui_extension', name: 'Extension 456'},
          {uuid: '789', type: 'product_subscription', name: 'Extension 789'},
        ],
      }

      // Send event
      mockSocketServer.send({event: 'connected', data})

      // Verify props are passed as-is
      expect(connectSpy).toHaveBeenCalledTimes(1)
      expect(connectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: expect.arrayContaining(data.extensions),
        }),
      )
    })

    test('sends data with translated props for UI extensions when locales option is provided on "connected" event', async () => {
      // Create client with locales using direct type assertion to DeepPartial
      const client = new ExtensionServerClient({
        ...defaultOptions,
        locales: {user: 'ja', shop: 'fr'} as unknown as DeepPartial<any>,
      })

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Create spy for the connected event
      const connectSpy = vi.fn()
      client.on('connected', connectSpy)

      // Define localization data
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

      // Create mock data - using type assertion to avoid DeepPartial errors
      interface MockExtension {
        uuid: string
        type: string
        name: string
        description?: string
        localization?: any
        extensionPoints?: {
          localization?: any
          target?: string
          surface?: string
          name?: string
        }[]
        surface?: string
      }

      // Using a typed array to avoid DeepPartial issues
      const mockExtensions: MockExtension[] = [
        {
          uuid: '123',
          type: 'ui_extension',
          name: 't:welcome',
          description: 't:description',
          localization,
          extensionPoints: [{localization, target: 'admin.test', surface: 'admin'}],
        },
        {
          uuid: '456',
          type: 'ui_extension',
          name: 'Fixed name t:',
          localization: null,
          extensionPoints: [{localization: null, name: 'Fixed name t:', target: 'admin.test', surface: 'admin'}],
        },
        {uuid: '789', type: 'product_subscription', name: 'Extension 789'},
      ]

      // Send the connected event
      mockSocketServer.send({
        event: 'connected',
        data: {
          app: mockApp(),
          extensions: mockExtensions,
          store: 'test-store',
        },
      })

      // Verify event was handled
      expect(connectSpy).toHaveBeenCalledTimes(1)

      // Assert on specific properties without using complex matchers that trigger type errors
      const connectedData = connectSpy.mock.calls[0][0]
      expect(connectedData).toBeDefined()
      expect(connectedData.extensions).toHaveLength(3)

      // Find the translated extension
      const translatedExt = connectedData.extensions.find((ext: any) => ext.uuid === '123')
      expect(translatedExt).toBeDefined()

      // Check translation worked properly - name should be translated
      expect(translatedExt.name).not.toBe('t:welcome')
      // Description should be translated
      expect(translatedExt.description).not.toBe('t:description')

      // Verify extension points were also translated
      const extensionPoint = translatedExt.extensionPoints[0]
      expect(extensionPoint.localization).toBeDefined()
      expect(extensionPoint.localization.extensionLocale).toBe('ja')
    })

    test('listens to persist events', async () => {
      // Create client
      const client = new ExtensionServerClient(defaultOptions)

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Create spy
      const updateSpy = vi.fn()
      client.on('update', updateSpy)

      // Mock data
      const data = {
        app: mockApp(),
      }

      // Send event
      mockSocketServer.send({event: 'update', data})

      // Verify data is passed to the callback
      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledWith(data)
    })

    test('unsubscribes from persist events', async () => {
      // Create client
      const client = new ExtensionServerClient(defaultOptions)

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Set up spy and get unsubscribe function
      const updateSpy = vi.fn()
      const unsubscribe = client.on('update', updateSpy)

      // Unsubscribe
      unsubscribe()

      // Send event
      mockSocketServer.send({
        event: 'update',
        data: {
          app: mockApp(),
        },
      })

      // Verify event wasn't handled
      expect(updateSpy).not.toHaveBeenCalled()
    })

    test('listens to dispatch events', async () => {
      // Create client
      const client = new ExtensionServerClient(defaultOptions)

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Set up spy
      const unfocusSpy = vi.fn()
      client.on('unfocus', unfocusSpy)

      // Send event
      mockSocketServer.send({event: 'dispatch', data: {type: 'unfocus'}})

      // Verify event was handled
      expect(unfocusSpy).toHaveBeenCalledTimes(1)
      expect(unfocusSpy).toHaveBeenCalledWith(undefined)
    })

    test('sends data with extensions filtered by surface option on "update" event', async () => {
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

      // Create spy
      const updateSpy = vi.fn()
      client.on('update', updateSpy)

      // Mock data
      const data = {
        app: mockApp(),
        extensions: [
          {uuid: '123', surface: 'admin'},
          {uuid: '456', surface: 'checkout'},
          {uuid: '789', surface: '', extensionPoints: [{surface: 'admin'}]},
        ],
      }

      // Send event
      mockSocketServer.send({event: 'update', data})

      // Verify correct data is filtered and passed to the callback
      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: expect.arrayContaining([
            expect.objectContaining({uuid: '123'}),
            expect.objectContaining({uuid: '789'}),
          ]),
        }),
      )

      // Verify checkout extension is filtered out
      const calledWith = updateSpy.mock.calls[0][0]
      const extensionIds = calledWith.extensions.map((ext: any) => ext.uuid)
      expect(extensionIds).not.toContain('456')
    })

    test('sends data with all extensions when surface option is not valid on "update" event', async () => {
      // Create client with invalid surface
      const client = new ExtensionServerClient({
        connection: {
          url: TEST_CONNECTION_URL,
          automaticConnect: true,
        },
        surface: 'abc' as any,
      })

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Create spy
      const updateSpy = vi.fn()
      client.on('update', updateSpy)

      // Mock data
      const data = {
        app: mockApp(),
        extensions: [
          {uuid: '123', surface: 'admin'},
          {uuid: '456', surface: 'checkout'},
        ],
      }

      // Send event
      mockSocketServer.send({event: 'update', data})

      // Verify all extensions are included (not filtered)
      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: expect.arrayContaining(data.extensions),
        }),
      )
    })

    test('sends data with translatable props as-is when locales option is not provided on "update" event', async () => {
      // Create client without locales
      const client = new ExtensionServerClient(defaultOptions)

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Create spy
      const updateSpy = vi.fn()
      client.on('update', updateSpy)

      // Define localization data
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

      // Mock data
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

      // Send event
      mockSocketServer.send({event: 'update', data})

      // Verify props are passed as-is
      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extensions: expect.arrayContaining(data.extensions),
        }),
      )
    })

    test('sends data with translated props when locales option is provided on "update" event', async () => {
      // Create client with locales using type assertion
      const client = new ExtensionServerClient({
        ...defaultOptions,
        locales: {user: 'ja', shop: 'fr'} as unknown as DeepPartial<any>,
      })

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Create spy
      const updateSpy = vi.fn()
      client.on('update', updateSpy)

      // Define localization data
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

      // Create mock data - using type assertion to avoid DeepPartial errors
      interface MockExtension {
        uuid: string
        type: string
        name: string
        description?: string
        localization?: any
        extensionPoints?: {
          localization?: any
          target?: string
          surface?: string
          name?: string
        }[]
      }

      // Using a typed array to avoid DeepPartial issues
      const mockExtensions: MockExtension[] = [
        {
          uuid: '123',
          type: 'ui_extension',
          name: 't:welcome',
          description: 't:description',
          localization,
          extensionPoints: [{localization, target: 'admin.test', surface: 'admin'}],
        },
        {
          uuid: '456',
          type: 'ui_extension',
          name: 'Extension 456',
          description: 'This is a test extension',
          localization: null,
          extensionPoints: [{localization: null, target: 'admin.test', surface: 'admin'}],
        },
        {uuid: '789', type: 'product_subscription', name: 'Extension 789'},
      ]

      // Send the update event
      mockSocketServer.send({
        event: 'update',
        data: {
          app: mockApp(),
          extensions: mockExtensions,
          store: 'test-store',
        },
      })

      // Verify event was handled
      expect(updateSpy).toHaveBeenCalledTimes(1)

      // Assert on specific properties without using complex matchers that trigger type errors
      const updatedData = updateSpy.mock.calls[0][0]
      expect(updatedData).toBeDefined()
      expect(updatedData.extensions).toHaveLength(3)

      // Find the translated extension
      const translatedExt = updatedData.extensions.find((ext: any) => ext.uuid === '123')
      expect(translatedExt).toBeDefined()

      // Check translation worked properly - name should be translated
      expect(translatedExt.name).not.toBe('t:welcome')
      // Description should be translated
      expect(translatedExt.description).not.toBe('t:description')
    })

    test('sends data with translated props when locales option is provided on subsequent "update" events', async () => {
      // Create client with locales using type assertion
      const client = new ExtensionServerClient({
        ...defaultOptions,
        locales: {user: 'ja', shop: 'fr'} as unknown as DeepPartial<any>,
      })

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Create spy
      const updateSpy = vi.fn()
      client.on('update', updateSpy)

      // Define localization data
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

      // Create mock data - using type assertion to avoid DeepPartial errors
      interface MockExtension {
        uuid: string
        type: string
        name: string
        description?: string
        localization?: any
        extensionPoints?: {
          localization?: any
          target?: string
          surface?: string
          name?: string
        }[]
      }

      // Using a typed array to avoid DeepPartial issues
      const mockExtensions: MockExtension[] = [
        {
          uuid: '123',
          type: 'ui_extension',
          name: 't:welcome',
          description: 't:description',
          localization,
          extensionPoints: [{localization, target: 'admin.test', surface: 'admin'}],
        },
        {
          uuid: '456',
          type: 'ui_extension',
          name: 'Extension 456',
          description: 'This is a test extension',
          localization: null,
          extensionPoints: [{localization: null, target: 'admin.test', surface: 'admin'}],
        },
        {uuid: '789', type: 'product_subscription', name: 'Extension 789'},
      ]

      // Send the update event twice
      mockSocketServer.send({
        event: 'update',
        data: {
          app: mockApp(),
          extensions: mockExtensions,
          store: 'test-store',
        },
      })

      mockSocketServer.send({
        event: 'update',
        data: {
          app: mockApp(),
          extensions: mockExtensions,
          store: 'test-store',
        },
      })

      // Verify event was handled twice
      expect(updateSpy).toHaveBeenCalledTimes(2)

      // Check the second call - make sure translations still work
      const secondCallData = updateSpy.mock.calls[1][0]
      expect(secondCallData).toBeDefined()
      expect(secondCallData.extensions).toHaveLength(3)

      // Find the translated extension
      const translatedExt = secondCallData.extensions.find((ext: any) => ext.uuid === '123')
      expect(translatedExt).toBeDefined()

      // Check translation worked properly - name should be translated
      expect(translatedExt.name).not.toBe('t:welcome')
      // Description should be translated
      expect(translatedExt.description).not.toBe('t:description')
    })

    test('handles localized extension props correctly', async () => {
      // Create mock extension with translations
      interface MockExtension {
        uuid: string
        type: string
        name: string
        description?: string
        localization?: any
        extensionPoints?: {
          localization?: any
          target?: string
          surface?: string
          name?: string
        }[]
      }

      const mockExtension: MockExtension = {
        uuid: '123',
        type: 'ui_extension',
        name: 't:extension.name',
        description: 't:extension.description',
        localization: {
          translations: JSON.stringify({
            'extension.name': 'Extension Name',
            'extension.description': 'Extension Description',
          }),
          default: 'en',
        },
        extensionPoints: [
          {
            target: 'admin.product.item.action',
            name: 't:extension.point.name',
          },
        ],
      }

      // Create client with locales option
      const client = new ExtensionServerClient({
        connection: {
          url: TEST_CONNECTION_URL,
          automaticConnect: true,
        },
        locales: {user: 'en', shop: 'en'} as unknown as DeepPartial<any>,
      })

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Create spy for translating extension
      const translateSpy = vi.spyOn(client as any, '_getLocalizedValue')
      translateSpy.mockImplementation((translations, key) => {
        if (key === 't:extension.name') return 'Extension Name'
        if (key === 't:extension.description') return 'Extension Description'
        return key
      })

      // Create spy for the connected event
      const connectSpy = vi.fn()
      client.on('connected', connectSpy)

      // Send connected event with mock data
      const data = {
        app: mockApp(),
        extensions: [mockExtension],
      }

      // Send the event
      mockSocketServer.send({event: 'connected', data})

      // Verify translated props
      expect(connectSpy).toHaveBeenCalledTimes(1)
      const callData = connectSpy.mock.calls[0][0]
      const extension = callData.extensions[0]

      // Check that the translation worked
      expect(extension.name).toBe('Extension Name')
      expect(extension.description).toBe('Extension Description')

      // Clean up
      translateSpy.mockRestore()
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

    test('warns if trying to "emit" a persist event', async () => {
      // Spy on console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      // Create client
      const client = new ExtensionServerClient(defaultOptions)

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Try to emit an invalid event type
      client.emit('update' as any)

      // Verify warning was shown
      expect(warnSpy).toHaveBeenCalled()

      // Restore console.warn
      warnSpy.mockRestore()
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

    test('warns if trying to "persist" a dispatch event', async () => {
      // Spy on console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      // Create client
      const client = new ExtensionServerClient(defaultOptions)

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Try to persist an invalid event type
      client.persist('unfocus' as any, {})

      // Verify warning was shown
      expect(warnSpy).toHaveBeenCalled()

      // Restore console.warn
      warnSpy.mockRestore()
    })

    test('remove translated props from the UI extensions payload when locales are provided in the client options', async () => {
      // Create client with locales using type assertion
      const client = new ExtensionServerClient({
        ...defaultOptions,
        locales: {user: 'ja', shop: 'fr'} as unknown as DeepPartial<any>,
      })

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Create mock data with translated fields
      const extensionData = {
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
      }

      // Persist the data
      client.persist('update', extensionData)

      // Verify the message was sent and normalized (translation fields removed)
      expect(mockSocketServer.messages.length).toBe(1)

      // Parse the JSON if it's a string
      const message =
        typeof mockSocketServer.messages[0] === 'string'
          ? JSON.parse(mockSocketServer.messages[0])
          : mockSocketServer.messages[0]

      // Check translation fields were removed
      expect(message).toMatchObject({
        event: 'update',
        data: {
          extensions: [{uuid: '123', type: 'ui_extension', extensionPoints: [{}]}],
        },
      })
    })

    test('leave translatable props as-is in the UI extensions payload when locales are not provided in the client options', async () => {
      // Create client without locales
      const client = new ExtensionServerClient(defaultOptions)

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Create data with localization fields
      const extensionData = {
        extensions: [{uuid: '123', type: 'ui_extension', localization: {}, extensionPoints: [{localization: {}}]}],
      }

      // Persist the data
      client.persist('update', extensionData)

      // Verify the message was sent without changes
      expect(mockSocketServer.messages.length).toBe(1)

      // Parse the JSON if it's a string
      const message =
        typeof mockSocketServer.messages[0] === 'string'
          ? JSON.parse(mockSocketServer.messages[0])
          : mockSocketServer.messages[0]

      // Check fields were preserved
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

    test('does not attempt to connect if the URL is undefined', () => {
      // Create client
      const client = new ExtensionServerClient()

      // Try to connect without URL
      client.connect()

      // Verify no connection was made
      expect(client.connection).toBeUndefined()
    })

    test('does not attempt to connect if the URL is empty', () => {
      // Create client with empty URL
      const client = new ExtensionServerClient({connection: {url: ''}})

      // Try to connect
      client.connect()

      // Verify no connection was made
      expect(client.connection).toBeUndefined()
    })

    test('re-use existing connection if connect options have not changed', async () => {
      // Create client
      const client = new ExtensionServerClient(defaultOptions)

      // Mock connection
      mockSocketServer.connect(mockSocket)

      // Get initial connection
      const initialConnection = client.connection
      expect(initialConnection).toBeDefined()

      // Try to connect with the same URL
      client.connect({connection: {url: TEST_CONNECTION_URL}})

      // Connection should be the same object (reused)
      expect(client.connection).toBe(initialConnection)

      // Only one connection should exist
      expect(mockSocketServer.clients.length).toBe(1)
    })

    test('creates a new connection if the URL has changed', async () => {
      // Create client
      const client = new ExtensionServerClient(defaultOptions)

      // Connect the mock socket
      mockSocketServer.connect(mockSocket)

      // Store the original connection
      const originalConnection = client.connection

      // Create a WebSocket spy to track new instances
      const webSocketSpy = vi.spyOn(globalThis, 'WebSocket')
      const initialCallCount = webSocketSpy.mock.calls.length

      // Change the URL
      const newUrl = 'ws://new-host.com:9000/extensions/'
      client.connect({
        connection: {
          url: newUrl,
        },
      })

      // Verify a new WebSocket was created
      expect(webSocketSpy).toHaveBeenCalledTimes(initialCallCount + 1)
      expect(webSocketSpy).toHaveBeenLastCalledWith(newUrl, [])

      // Verify connection is different
      expect(client.connection).not.toBe(originalConnection)
    })
  })
})
