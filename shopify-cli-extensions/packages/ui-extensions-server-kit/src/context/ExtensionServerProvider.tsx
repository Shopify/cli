import React, {useCallback, useMemo, useState} from 'react';

import {isValidSurface} from '../utilities/isValidSurface';
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

import {extensionServerContext} from './constants';
import type {ExtensionServerProviderProps} from './types';

function getValidatedOptions(options: ExtensionServer.Options): ExtensionServer.Options {
  if (!isValidSurface(options.surface)) {
    delete options.surface;
  }
  return options;
}

export function ExtensionServerProvider({
  children,
  options: defaultOptions,
}: ExtensionServerProviderProps) {
  const [state, dispatch] = useExtensionServerState();
  const [options, setOptions] = useState(getValidatedOptions(defaultOptions));
  const [client] = useState<ExtensionServer.Client>(() => new ExtensionServerClient());

  const connect = useCallback(
    (newOptions: ExtensionServer.Options = options) => {
      setOptions(getValidatedOptions(newOptions));
    },
    [options],
  );

  useIsomorphicLayoutEffect(() => client.connect(options), [client, options]);

  useIsomorphicLayoutEffect(() => {
    const listeners = [
      client.on('update', (payload) => dispatch(createUpdateAction(payload))),
      client.on('connected', (payload) => dispatch(createConnectedAction(payload))),
      client.on('refresh', (payload) => dispatch(createRefreshAction(payload))),
      client.on('focus', (payload) => dispatch(createFocusAction(payload))),
      client.on('unfocus', (payload) => dispatch(createUnfocusAction(payload))),
    ];

    return () => listeners.forEach((unsubscribe) => unsubscribe());
  }, [dispatch]);

  const context = useMemo(
    () => ({dispatch, state, connect, client}),
    [dispatch, connect, state, client],
  );

  return (
    <extensionServerContext.Provider value={context}>{children}</extensionServerContext.Provider>
  );
}
