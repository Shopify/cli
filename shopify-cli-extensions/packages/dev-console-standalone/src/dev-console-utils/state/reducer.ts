import {DevServerResponse} from '../types';
import {useReducer} from 'react';

import {ConsoleState} from './types';

export const initialConsoleState: ConsoleState = {extensions: []};

export function useConsoleReducer() {
  return useReducer(consoleReducer, initialConsoleState);
}

function consoleReducer(state: ConsoleState, response: DevServerResponse): ConsoleState {
  if (response.event === 'dispatch') return state;
  const extensions = response.data.extensions;
  const map = groupByKey('uuid', extensions);
  switch (response.event) {
    case 'connected':
      return {extensions};
    case 'update':
      const updated = state.extensions.map(extension => map.get(extension.uuid) || extension);
      return {extensions: updated};
    default:
      return state;
  }
}

function groupByKey<T extends object>(key: keyof T, items: T[]): Map<T[keyof T], T> {
  return new Map(
    items.map(item => ([item[key], item])),
  );
}
