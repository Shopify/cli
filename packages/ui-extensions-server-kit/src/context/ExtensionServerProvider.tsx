import {extensionServerContext} from './constants'
import {
  createConnectedAction,
  createUpdateAction,
  createRefreshAction,
  createFocusAction,
  createUnfocusAction,
  createLogAction,
} from '../state'

import {ExtensionServerClient} from '../ExtensionServerClient'
import {ExtensionServer} from '../ExtensionServerClient/server-types.js'
import {useIsomorphicLayoutEffect} from '../hooks/useIsomorphicLayoutEffect'
import {useExtensionServerState} from '../hooks/useExtensionServerState'
import React, {useCallback, useMemo, useState} from 'react'

import type {ExtensionServerProviderProps} from './types'

export function ExtensionServerProvider({children, options: defaultOptions}: ExtensionServerProviderProps) {
  const [state, dispatch] = useExtensionServerState()
  const [options, setOptions] = useState(defaultOptions)
  const [client] = useState<ExtensionServer.Client>(() => new ExtensionServerClient())

  const connect = useCallback(
    (newOptions: ExtensionServer.Options = options) => {
      setOptions(newOptions)
    },
    [options],
  )

  useIsomorphicLayoutEffect(() => client.connect(options), [client, options])

  useIsomorphicLayoutEffect(() => {
    const listeners = [
      client.on('update', (payload) => dispatch(createUpdateAction(payload))),
      client.on('connected', (payload) => dispatch(createConnectedAction(payload))),
      client.on('refresh', (payload) => dispatch(createRefreshAction(payload))),
      client.on('focus', (payload) => dispatch(createFocusAction(payload))),
      client.on('unfocus', (payload) => dispatch(createUnfocusAction(payload))),
      client.on('log', (payload) => dispatch(createLogAction(payload))),
    ]

    return () => listeners.forEach((unsubscribe) => unsubscribe())
  }, [dispatch])

  const context = useMemo(() => ({dispatch, state, connect, client}), [dispatch, connect, state, client])

  return <extensionServerContext.Provider value={context}>{children}</extensionServerContext.Provider>
}
