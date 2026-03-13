import {ExtensionServerProvider} from './ExtensionServerProvider'
import {useExtensionServerContext} from '../hooks'
import {createConnectedAction} from '../state'
import {mockApp, mockExtension} from '../testing'
import React from 'react'
import {beforeEach, afterEach, expect} from 'vitest'
import {renderHook, act} from '@testing-library/react'

class MockWebSocketServer {
  clients: MockWebSocket[] = []
  messages: any[] = []

  connect(socket: MockWebSocket) {
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
  private eventListeners: Record<string, Set<EventListener>> = {
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

let mockSocketServer: MockWebSocketServer
let originalWebSocket: typeof WebSocket

function createWrapper(options: {connection: {url?: string}}) {
  return function Wrapper({children}: {children: React.ReactNode}) {
    return <ExtensionServerProvider options={options}>{children}</ExtensionServerProvider>
  }
}

beforeEach(() => {
  mockSocketServer = new MockWebSocketServer()

  originalWebSocket = globalThis.WebSocket

  globalThis.WebSocket = function (url: string) {
    const socket = new MockWebSocket(url, mockSocketServer)
    return socket as unknown as WebSocket
  } as unknown as typeof WebSocket
})

afterEach(() => {
  globalThis.WebSocket = originalWebSocket
})

describe('ExtensionServerProvider tests', () => {
  describe('client tests', () => {
    test('creates a new ExtensionServerClient instance', async () => {
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}}

      const {result} = renderHook(useExtensionServerContext, {wrapper: createWrapper(options)})

      expect(result.current.client).toBeDefined()
    })

    test('does not start a new connection if an empty url is passed', async () => {
      const options = {connection: {}}

      const {result} = renderHook(useExtensionServerContext, {wrapper: createWrapper(options)})

      expect(result.current.client.connection).toBeUndefined()
    })
  })

  describe('connect tests', () => {
    test('starts a new connection by calling connect', async () => {
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}}

      const {result} = renderHook(useExtensionServerContext, {
        wrapper: createWrapper({connection: {url: ''}}),
      })

      act(() => result.current.connect(options))

      expect(result.current.client.connection).toBeDefined()
    })
  })

  describe('dispatch tests', () => {
    test('updates the state', async () => {
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}}
      const app = mockApp()
      const extension = mockExtension()
      const payload = {app, extensions: [extension], store: 'test-store.com'}

      const {result} = renderHook(useExtensionServerContext, {wrapper: createWrapper(options)})

      act(() => {
        result.current.dispatch({type: 'connected', payload})
      })

      expect(result.current.state).toStrictEqual({
        app,
        extensions: [extension],
        store: 'test-store.com',
      })
    })
  })

  describe('state tests', () => {
    test('persists connection data to the state', async () => {
      const app = mockApp()
      const extension = mockExtension()
      const data = {app, store: 'test-store.com', extensions: [extension]}
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}}

      const {result} = renderHook(useExtensionServerContext, {wrapper: createWrapper(options)})

      act(() => {
        result.current.dispatch(createConnectedAction(data))
      })

      expect(result.current.state).toEqual({
        app,
        extensions: [extension],
        store: 'test-store.com',
      })
    })

    test('persists update data to the state', async () => {
      const app = mockApp()
      const extension = mockExtension()
      const update = {...extension, version: 'v2'}
      const data = {app, store: 'test-store.com', extensions: [extension]}
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}}

      const {result} = renderHook(useExtensionServerContext, {wrapper: createWrapper(options)})

      act(() => {
        result.current.dispatch(createConnectedAction(data))
      })

      act(() => {
        result.current.dispatch(createConnectedAction({...data, extensions: [update]}))
      })

      expect(result.current.state).toEqual({
        app,
        extensions: [update],
        store: 'test-store.com',
      })
    })

    test('persists refresh data to the state', async () => {
      const app = mockApp()
      const extension = mockExtension()
      const data = {app, store: 'test-store.com', extensions: [extension]}
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}}

      const {result} = renderHook(useExtensionServerContext, {wrapper: createWrapper(options)})

      act(() => {
        result.current.dispatch(createConnectedAction(data))
      })

      expect(result.current.state.extensions.length).toBe(1)
      expect(result.current.state.extensions[0].uuid).toBe(extension.uuid)
    })

    test('persists focus data to the state', async () => {
      const app = mockApp()
      const extension = {
        ...mockExtension(),
        development: {
          ...mockExtension().development,
          focused: false,
        },
      }
      const data = {app, store: 'test-store.com', extensions: [extension]}
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}}

      const {result} = renderHook(useExtensionServerContext, {wrapper: createWrapper(options)})

      act(() => {
        result.current.dispatch(createConnectedAction(data))
      })

      act(() => {
        const focusedExtension = {
          ...extension,
          development: {
            ...extension.development,
            focused: true,
          },
        }
        result.current.dispatch(createConnectedAction({...data, extensions: [focusedExtension]}))
      })

      const [updatedExtension] = result.current.state.extensions
      expect(updatedExtension.development.focused).toBe(true)
    })

    test('persists unfocus data to the state', async () => {
      const app = mockApp()
      const extension = {
        ...mockExtension(),
        development: {
          ...mockExtension().development,
          focused: true,
        },
      }

      const data = {app, store: 'test-store.com', extensions: [extension]}
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}}

      const {result} = renderHook(useExtensionServerContext, {wrapper: createWrapper(options)})

      act(() => {
        result.current.dispatch(createConnectedAction(data))
      })

      act(() => {
        const unfocusedExtension = {
          ...extension,
          development: {
            ...extension.development,
            focused: false,
          },
        }
        result.current.dispatch(createConnectedAction({...data, extensions: [unfocusedExtension]}))
      })

      const [updatedExtension] = result.current.state.extensions
      expect(updatedExtension.development.focused).toBe(false)
    })
  })
})
