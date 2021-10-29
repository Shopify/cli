import {useReducer} from 'react';

import {extensionSeverReducer, INITIAL_STATE} from '../state';

export function useExtensionServerState() {
  return useReducer(extensionSeverReducer, INITIAL_STATE);
}
