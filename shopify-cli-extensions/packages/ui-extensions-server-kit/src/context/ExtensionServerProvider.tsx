import React, {useCallback, useMemo, useRef, useState} from 'react';

import {
  createConnectedAction,
  createUpdateAction,
  createRefreshAction,
  createFocusAction,
  createUnfocusAction,
} from '../state';
import {ExtensionServerClient} from '../ExtensionServerClient';
import {useIsomorphicLayoutEffect} from '../hooks/useIsomorphicLayoutEffect';
import {useExtensionServerState} from '../hooks/useExtensionServerState';
import {noop} from '../utilities';

import {extensionServerContext} from './constants';
import type {ExtensionServerProviderProps} from './types';

export function ExtensionServerProvider({
  children,
  options: defaultOptions,
}: ExtensionServerProviderProps) {
  const [state, dispatch] = useExtensionServerState();
  const [options, setOptions] = useState(defaultOptions);
  const client = useRef<ExtensionServer.Client>();

  const connect = useCallback(
    (newOptions: ExtensionServer.Options = options) => {
      setOptions({...newOptions});
    },
    [options],
  );

  useIsomorphicLayoutEffect(() => {
    if (!client.current) {
      client.current = new ExtensionServerClient(options);
    }
    return client.current.connect(options) ?? noop;
  }, [options]);

  useIsomorphicLayoutEffect(() => {
    const listeners = [
      client.current?.on('update', (payload) => dispatch(createUpdateAction(payload))),
      client.current?.on('connected', (payload) => dispatch(createConnectedAction(payload))),
      client.current?.on('refresh', (payload) => dispatch(createRefreshAction(payload))),
      client.current?.on('focus', (payload) => dispatch(createFocusAction(payload))),
      client.current?.on('unfocus', (payload) => dispatch(createUnfocusAction(payload))),
    ];

    return () => listeners.forEach((unsubscribe) => unsubscribe?.());
  }, [dispatch]);

  const context = useMemo(
    () => ({dispatch, state, connect, client: client.current}),
    [dispatch, connect, state],
  );

  return (
    <extensionServerContext.Provider value={context}>{children}</extensionServerContext.Provider>
  );
}
