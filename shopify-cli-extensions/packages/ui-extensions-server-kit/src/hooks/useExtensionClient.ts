import {useRef} from 'react';
import {ExtensionServerClient} from '../ExtensionServerClient';
import {useExtensionServerContext} from './useExtensionServerContext';
import {useIsomorphicLayoutEffect} from './useIsomorphicLayoutEffect';

export function useExtensionClient() {
  const {client} = useExtensionServerContext();
  return client;
}
