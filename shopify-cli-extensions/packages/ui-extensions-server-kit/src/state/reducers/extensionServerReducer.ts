import {set, replaceUpdated} from '../../utilities';
import type {ExtensionServerActions} from '../actions';

import type {ExtensionServerState} from './types';

export function extensionServerReducer(
  state: ExtensionServerState,
  action: ExtensionServerActions,
) {
  switch (action.type) {
    case 'connected': {
      return {
        ...state,
        store: action.payload.store,
        app: {...(state.app ?? {}), ...(action.payload.app ?? {})},
        extensions: replaceUpdated(
          state.extensions,
          action.payload.extensions ?? [],
          ({uuid}) => uuid,
        ),
      } as ExtensionServerState;
    }

    case 'update': {
      return {
        ...state,
        app: {...(state.app ?? {}), ...(action.payload.app ?? {})},
        extensions: replaceUpdated(
          state.extensions,
          action.payload.extensions ?? [],
          ({uuid}) => uuid,
        ),
      } as ExtensionServerState;
    }

    case 'refresh': {
      return {
        ...state,
        extensions: state.extensions.map((extension) => {
          if (action.payload.some(({uuid}) => extension.uuid === uuid)) {
            const url = new URL(extension.assets.main.url);
            url.searchParams.set('timestamp', String(Date.now()));
            return set(extension, (ext) => ext.assets.main.url, url.toString());
          }
          return extension;
        }),
      };
    }

    case 'focus': {
      return {
        ...state,
        extensions: state.extensions.map((extension) => {
          if (action.payload.some(({uuid}) => extension.uuid === uuid)) {
            return set(extension, (ext) => ext.development.focused, true);
          } else if (extension.development.focused) {
            return set(extension, (ext) => ext.development.focused, false);
          }
          return extension;
        }),
      };
    }

    case 'unfocus': {
      return {
        ...state,
        extensions: state.extensions.map((extension) => {
          if (extension.development.focused) {
            return set(extension, (ext) => ext.development.focused, false);
          }
          return extension;
        }),
      };
    }

    default:
      return state;
  }
}
