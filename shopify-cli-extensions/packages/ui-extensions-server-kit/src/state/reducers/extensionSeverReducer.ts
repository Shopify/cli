import {ExtensionPayload} from '../../types';
import {removeDuplicates} from '../../utilities/removeDuplicates';
import type {ExtensionServerActions} from '../actions';

import type {ExtensionServerState} from './types';

export function extensionSeverReducer(state: ExtensionServerState, action: ExtensionServerActions) {
  switch (action.type) {
    case 'connected': {
      return {
        ...state,
        app: {...(state?.app ?? {}), ...(action.payload?.app ?? {})},
        extensions: removeDuplicates(
          [...(action.payload.extensions ?? []), ...state.extensions],
          ({uuid}) => uuid,
        ),
      } as ExtensionServerState;
    }

    case 'update': {
      return {
        ...state,
        app: {...(state?.app ?? {}), ...(action.payload?.app ?? {})},
        extensions: removeDuplicates(
          [...(action.payload.extensions ?? []), ...state.extensions],
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
            return {
              ...extension,
              assets: {
                ...extension.assets,
                main: {
                  ...extension.assets.main,
                  url: url.toString(),
                },
              },
            };
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
            return {
              ...extension,
              development: {
                ...extension.development,
                focused: true,
              },
            };
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
            return {
              ...extension,
              development: {
                ...extension.development,
                focused: false,
              },
            };
          }
          return extension;
        }),
      };
    }

    default:
      return state;
  }
}
