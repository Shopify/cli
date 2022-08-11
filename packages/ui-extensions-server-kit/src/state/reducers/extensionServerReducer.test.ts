import {extensionServerReducer} from './extensionServerReducer'
import {INITIAL_STATE} from './constants'
import {mockExtension, mockApp} from '../../testing'
import {
  createConnectedAction,
  createUpdateAction,
  createRefreshAction,
  createFocusAction,
  createUnfocusAction,
} from '../actions'

import type {ExtensionServerState} from './types'

describe('extensionServerReducer()', () => {
  it('connects to server', () => {
    const app = mockApp()
    const extension = mockExtension()
    const action = createConnectedAction({app, extensions: [extension], store: 'test-store.com'})
    const state = extensionServerReducer(INITIAL_STATE, action)

    expect(state).toStrictEqual({
      app,
      extensions: [extension],
      store: 'test-store.com',
    })
  })

  it('receives updates from the server', () => {
    const extension1 = mockExtension()
    const extension2 = mockExtension()
    const previousState: ExtensionServerState = {
      store: 'test-store.com',
      extensions: [extension1, extension2],
    }

    const app = mockApp()
    const updated1 = {...extension1, version: 'v2'}
    const action = createUpdateAction({app, extensions: [updated1]})

    const state = extensionServerReducer(previousState, action)

    expect(state).toStrictEqual({
      app,
      extensions: [updated1, extension2],
      store: 'test-store.com',
    })
  })

  it('maintains extension order after update', () => {
    const extension1 = mockExtension()
    const extension2 = mockExtension()
    const previousState: ExtensionServerState = {
      store: 'test-store.com',
      extensions: [extension1, extension2],
    }

    const app = mockApp()
    const updated2 = {...extension2, version: 'v2'}
    const action = createUpdateAction({app, extensions: [updated2]})

    const state = extensionServerReducer(previousState, action)

    expect(state).toStrictEqual({
      app,
      extensions: [extension1, updated2],
      store: 'test-store.com',
    })
  })

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('refreshes extension url', async () => {
    const extension = mockExtension()
    const previousState: ExtensionServerState = {
      store: 'test-store.com',
      extensions: [extension],
    }

    const action = createRefreshAction([{uuid: extension.uuid}])

    const state1 = extensionServerReducer(previousState, action)
    // eslint-disable-next-line node/no-unsupported-features/node-builtins
    const url1 = new URL(state1.extensions[0].assets.main.url)
    const timestamp1 = url1.searchParams.get('lastUpdated') || ''

    expect(timestamp1.length).toBeGreaterThan(0)

    // sleep 1ms to guarantee new timestamp
    await new Promise((resolve) => setTimeout(resolve, 1))

    const state2 = extensionServerReducer(state1, action)
    // eslint-disable-next-line node/no-unsupported-features/node-builtins
    const url2 = new URL(state2.extensions[0].assets.main.url)
    const timestamp2 = url2.searchParams.get('lastUpdated') || ''

    expect(timestamp2.length).toBeGreaterThan(0)
    expect(timestamp1).not.toStrictEqual(timestamp2)
  })

  // eslint-disable-next-line jest/max-nested-describe
  describe('focus', () => {
    it('focuses only one extension', () => {
      const extension1 = mockExtension()
      const extension2 = mockExtension()

      const previousState: ExtensionServerState = {
        store: 'test-store.com',
        extensions: [extension1, extension2],
      }

      const action1 = createFocusAction([{uuid: extension1.uuid}])
      const state1 = extensionServerReducer(previousState, action1)

      expect(state1.extensions[0].development.focused).toBe(true)

      const action2 = createFocusAction([{uuid: extension2.uuid}])
      const state2 = extensionServerReducer(state1, action2)

      expect(state2.extensions[0].development.focused).toBe(false)
      expect(state2.extensions[1].development.focused).toBe(true)
    })

    it('unfocuses extension', () => {
      const extension = mockExtension({development: {focused: true}})

      const previousState: ExtensionServerState = {
        store: 'test-store.com',
        extensions: [extension],
      }

      const action = createUnfocusAction()
      const state = extensionServerReducer(previousState, action)

      expect(state.extensions[0].development.focused).toBe(false)
    })
  })
})
