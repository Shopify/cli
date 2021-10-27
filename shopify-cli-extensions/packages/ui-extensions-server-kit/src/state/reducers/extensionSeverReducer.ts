import {groupByKey} from '../../utilities';
import type {ExtensionServerActions} from '../actions';
import type {ExtensionServerState} from './types';

export function extensionSeverReducer(state: ExtensionServerState, action: ExtensionServerActions) {
  switch (action.type) {
    case 'connected':
      return {...state, ...action.payload};

    case 'update': {
      const {extensions, ...app} = action.payload;
      const updatedState = {...state, ...app};
      if (extensions) {
        const map = groupByKey('uuid', extensions);
        const updated = (state.extensions || []).map(
          (extension) => map.get(extension.uuid) || extension,
        );
        updatedState.extensions = updated;
      }
      return updatedState;
    }

    default:
      return state;
  }
}
