import {ExtensionServerProvider} from './ExtensionServerProvider'
import {mockApp, mockExtension} from '../testing'
import {useExtensionServerContext} from '../hooks'
import {createConnectedAction} from '../state'
import WS from 'jest-websocket-mock'
import {renderHook, withProviders} from '@shopify/ui-extensions-test-utils'

describe('ExtensionServerProvider tests', () => {
  describe('client tests', () => {
    test('creates a new ExtensionServerClient instance', async () => {
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}}

      const wrapper = renderHook(useExtensionServerContext, withProviders(ExtensionServerProvider), {options})

      expect(wrapper.result.client).toBeDefined()
    })

    test('does not start a new connection if an empty url is passed', async () => {
      const options = {connection: {}}

      const wrapper = renderHook(useExtensionServerContext, withProviders(ExtensionServerProvider), {options})

      expect(wrapper.result.client.connection).toBeUndefined()
    })
  })

  describe('connect tests', () => {
    test('starts a new connection by calling connect', async () => {
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}}
      const socket = new WS(options.connection.url, {jsonProtocol: true})
      const wrapper = renderHook(useExtensionServerContext, withProviders(ExtensionServerProvider), {
        options: {
          connection: {url: ''},
        },
      })

      expect(socket.server.clients()).toHaveLength(0)

      wrapper.act(({connect}) => connect(options))

      expect(wrapper.result.client.connection).toBeDefined()
      expect(socket.server.clients()).toHaveLength(1)
      socket.close()
    })
  })

  describe('dispatch tests', () => {
    test('updates the state', async () => {
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}}
      const app = mockApp()
      const extension = mockExtension()
      const payload = {app, extensions: [extension], store: 'test-store.com'}
      const wrapper = renderHook(useExtensionServerContext, withProviders(ExtensionServerProvider), {options})

      wrapper.act(({dispatch}) => {
        dispatch({type: 'connected', payload})
      })

      expect(wrapper.result.state).toStrictEqual({
        app,
        extensions: [extension],
        store: 'test-store.com',
      })
    })
  })

  describe('state tests', () => {
    let socket: WS
    const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}}

    beforeEach(() => {
      socket = new WS(options.connection.url, {jsonProtocol: true})
    })

    afterEach(() => {
      socket.close()
    })

    test('persists connection data to the state', async () => {
      const app = mockApp()
      const extension = mockExtension()
      const data = {app, store: 'test-store.com', extensions: [extension]}
      const wrapper = renderHook(useExtensionServerContext, withProviders(ExtensionServerProvider), {options})

      wrapper.act(() => socket.send({event: 'connected', data}))

      expect(wrapper.result.state).toEqual({
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
      const wrapper = renderHook(useExtensionServerContext, withProviders(ExtensionServerProvider), {options})

      wrapper.act(({dispatch}) => {
        dispatch(createConnectedAction(data))

        socket.send({event: 'update', data: {...data, extensions: [update]}})
      })

      expect(wrapper.result.state).toEqual({
        app,
        extensions: [update],
        store: 'test-store.com',
      })
    })

    // eslint-disable-next-line jest/no-disabled-tests
    test.skip('persists refresh data to the state', async () => {
      const app = mockApp()
      const extension = mockExtension()
      const data = {app, store: 'test-store.com', extensions: [extension]}
      const wrapper = renderHook(useExtensionServerContext, withProviders(ExtensionServerProvider), {options})

      wrapper.act(({dispatch}) => {
        dispatch(createConnectedAction(data))

        socket.send({
          event: 'dispatch',
          data: {type: 'refresh', payload: [{uuid: extension.uuid}]},
        })
      })

      const [updatedExtension] = wrapper.result.state.extensions
      expect(updatedExtension.assets.main.url).not.toEqual(extension.assets.main.url)
    })

    test('persists focus data to the state', async () => {
      const app = mockApp()
      const extension = mockExtension()
      const data = {app, store: 'test-store.com', extensions: [extension]}
      const wrapper = renderHook(useExtensionServerContext, withProviders(ExtensionServerProvider), {options})

      wrapper.act(({dispatch}) => {
        dispatch(createConnectedAction(data))

        socket.send({
          event: 'dispatch',
          data: {type: 'focus', payload: [{uuid: extension.uuid}]},
        })
      })

      const [updatedExtension] = wrapper.result.state.extensions
      expect(updatedExtension.development.focused).toBe(true)
    })

    test('persists unfocus data to the state', async () => {
      const app = mockApp()
      const extension = mockExtension()
      extension.development.focused = true
      const data = {app, store: 'test-store.com', extensions: [extension]}
      const wrapper = renderHook(useExtensionServerContext, withProviders(ExtensionServerProvider), {options})

      wrapper.act(({dispatch}) => {
        dispatch(createConnectedAction(data))

        socket.send({
          event: 'dispatch',
          data: {type: 'unfocus'},
        })
      })

      const [updatedExtension] = wrapper.result.state.extensions
      expect(updatedExtension.development.focused).toBe(false)
    })
  })
})
