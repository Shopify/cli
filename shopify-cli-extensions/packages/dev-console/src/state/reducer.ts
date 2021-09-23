import {useReducer} from 'react';

import {DevServerResponse} from '../types';

import {ConsoleState} from './types';

export const initialConsoleState: ConsoleState = {extensions: []};

export function useConsoleReducer() {
  return useReducer(consoleReducer, initialConsoleState);
}

function consoleReducer(state: ConsoleState, response: DevServerResponse): ConsoleState {
  if (response.event === 'dispatch') return state;
  
  switch (response.event) {
    case 'connected':
      return {...state, ...response.data};
    case 'update':
      const {extensions, ...app} = response.data;
      const updatedState = {...state, ...app};
      if (extensions) {
        const map = groupByKey('uuid', extensions);
        const updated = (state.extensions || []).map(extension => map.get(extension.uuid) || extension);
        updatedState.extensions = updated;
      }
      return updatedState;
    default:
      return state;
  }
}

function groupByKey<T extends object>(key: keyof T, items: T[]): Map<T[keyof T], T> {
  return new Map(
    items.map(item => ([item[key], item])),
  );
}
