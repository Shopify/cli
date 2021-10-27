import {createContext} from 'react';
import {INITIAL_STATE} from '../state';
import {noop} from '../utilities';
import type {ExtensionServerContext} from './types';

export const DEFAULT_VALUE: ExtensionServerContext = {
  connect: noop,
  state: INITIAL_STATE,
};

export const extensionServerContext = createContext<ExtensionServerContext>(DEFAULT_VALUE);
