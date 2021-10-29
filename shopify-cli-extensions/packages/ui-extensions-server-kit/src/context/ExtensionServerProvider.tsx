import React, {useCallback, useMemo, useRef, useState} from 'react';

import {createConnectedAction, createUpdateAction, INITIAL_STATE} from '../state';
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

  useIsomorphicLayoutEffect(
    () => client.current?.on('update', (payload) => dispatch(createUpdateAction(payload))),
    [dispatch],
  );

  useIsomorphicLayoutEffect(
    () => client.current?.on('connected', (payload) => dispatch(createConnectedAction(payload))),
    [dispatch],
  );

  const context = useMemo(() => ({state, connect, client: client.current}), [connect, state]);

  return (
    <extensionServerContext.Provider value={context}>{children}</extensionServerContext.Provider>
  );
}
