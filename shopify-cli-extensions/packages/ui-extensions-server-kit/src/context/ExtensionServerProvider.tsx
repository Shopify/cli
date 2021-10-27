import React, {useCallback, useRef, useState} from 'react';
import {createConnectedAction, createUpdateAction} from '../state';
import {ExtensionServerClient} from '../ExtensionServerClient';
import {useIsomorphicLayoutEffect, useExtensionServerState} from '../hooks';
import {extensionServerContext} from './constants';
import { noop } from '../utilities';
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

  return (
    <extensionServerContext.Provider value={{state, connect, client: client.current}}>
      {children}
    </extensionServerContext.Provider>
  );
}
