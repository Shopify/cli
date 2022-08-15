import React, {useMemo} from 'react';

import {ExtensionServerProvider, extensionServerContext} from '../context';
import {useExtensionServerContext} from '../hooks';
import type {ExtensionServerProviderProps, ExtensionServerContext} from '../context';

export interface InternalProviderProps extends Partial<ExtensionServerContext> {
  children?: ExtensionServerProviderProps['children'];
}

export function InternalProvider({children, ...mocks}: InternalProviderProps) {
  const actual = useExtensionServerContext();

  const context = useMemo(
    () => ({
      ...actual,
      ...mocks,
    }),
    [actual, mocks],
  );

  return (
    <extensionServerContext.Provider value={context}>{children}</extensionServerContext.Provider>
  );
}

export type MockExtensionServerProviderProps = Partial<ExtensionServerProviderProps> &
  InternalProviderProps;

export function MockExtensionServerProvider({
  children,
  options = {connection: {}},
  ...props
}: MockExtensionServerProviderProps) {
  return (
    <ExtensionServerProvider options={options}>
      <InternalProvider {...props}>{children}</InternalProvider>
    </ExtensionServerProvider>
  );
}
