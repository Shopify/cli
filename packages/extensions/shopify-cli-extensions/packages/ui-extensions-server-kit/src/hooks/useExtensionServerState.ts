import {useReducer} from 'react';

import {extensionServerReducer, INITIAL_STATE} from '../state';

export function useExtensionServerState() {
  return useReducer(extensionServerReducer, INITIAL_STATE);
}
