import React, {
  createContext,
  useEffect,
  useContext,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';

import {App, DevServerCall, DevServerResponse, ExtensionPayload} from '../types';

import {Console, Listener} from './types';
import {useConsoleReducer, initialConsoleState} from './reducer';

type UnsubscribeFn = () => void;

export interface DevServerContextValue {
  host: string;
  store: string;
  app?: App;
  extensions: ExtensionPayload[];
  send: (data: DevServerCall) => void;
  addListener: (listener: Listener) => UnsubscribeFn;
}

export const DevServerContext = createContext<DevServerContextValue>({
  host: '',
  ...initialConsoleState,
  send: noop,
  addListener: (_: any) => () => {},
});

export function DevConsoleProvider({children, host}: React.PropsWithChildren<{host: string}>) {
  const [state, update] = useConsoleReducer();
  const [send, setSend] = useState(() => noop);
  const listenersRef = useRef<Listener[]>([]);

  const addListener = useCallback((listener: Listener) => {
    listenersRef.current = listenersRef.current.concat(listener);

    return function unsubscribe() {
      listenersRef.current = listenersRef.current.filter((aListener) => aListener !== listener);
    };
  }, []);

  useEffect(() => {
    const websocket = new WebSocket(host);

    websocket.addEventListener('message', (socketEvent) => {
      const response: DevServerResponse = JSON.parse(socketEvent.data);
      if (response.event === 'update' || response.event === 'connected') {
        update(response);
      } else if (response.event === 'dispatch') {
        listenersRef.current.forEach((listener) => listener(response.data));
      } else {
        throw new Error(`Unhandled event type ${(response as any).event}`);
      }
    });

    websocket.addEventListener('open', () => {
      const sendFn = (data: any) => websocket.send(JSON.stringify(data));
      setSend(() => sendFn);
    });

    return () => {
      websocket.close();
    };
  }, [host, update]);

  const value = useMemo(
    () => ({host, ...state, send, addListener}),
    [addListener, host, send, state],
  );

  return <DevServerContext.Provider value={value}>{children}</DevServerContext.Provider>;
}

export function useListener(listener: Listener, deps: React.DependencyList = []) {
  const {addListener} = useContext(DevServerContext);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => addListener(listener), deps);
}

export function useDevConsole(): Console {
  const {extensions, app, store, send} = useContext(DevServerContext);

  return {
    app,
    store,
    extensions,
    update: (data) => send({event: 'update', data}),
    dispatch: (action) => send({event: 'dispatch', data: action}),
  };
}

function noop(_: any) {}
