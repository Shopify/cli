import {set, replaceUpdated, assetToString} from '../../utilities'
import type {ExtensionServerActions} from '../actions'
import type {ExtensionPayload} from '../../types'

import type {ExtensionServerState} from './types'

export function extensionServerReducer(state: ExtensionServerState, action: ExtensionServerActions) {
  switch (action.type) {
    case 'connected': {
      const extensions = (action.payload.extensions ?? []).map((extension) => {
        Object.keys(extension.assets).forEach(
          (asset) => (extension.assets[asset].url = assetToString(extension.assets[asset])),
        )
        return extension
      })
      return {
        ...state,
        store: action.payload.store,
        app: {
          ...action.payload.app,
          id: action.payload.app?.id ?? action.payload.appId,
        },
        extensions,
      } as ExtensionServerState
    }

    case 'update': {
      const extensions = (action.payload.extensions ?? []).map((extension) => {
        Object.keys(extension.assets).forEach(
          (asset) => (extension.assets[asset].url = assetToString(extension.assets[asset])),
        )
        return extension
      })
      return {
        ...state,
        app: {...(state.app ?? {}), ...(action.payload.app ?? {})},
        extensions: replaceUpdated(state.extensions, extensions, ({uuid}) => uuid),
      } as ExtensionServerState
    }

    case 'refresh': {
      return {
        ...state,
        extensions: state.extensions.map((extension) => {
          if (action.payload.some(({uuid}) => extension.uuid === uuid)) {
            const assets: ExtensionPayload['assets'] = {}
            Object.keys(extension.assets).forEach((asset) => {
              const resourceURL = {...extension.assets[asset]}
              resourceURL.lastUpdated = Date.now()
              resourceURL.url = assetToString(resourceURL)

              assets[asset] = resourceURL
            })
            return set(extension, (ext) => ext.assets, assets)
          }
          return extension
        }),
      }
    }

    case 'focus': {
      return {
        ...state,
        extensions: state.extensions.map((extension) => {
          if (action.payload.some(({uuid}) => extension.uuid === uuid)) {
            return set(extension, (ext) => ext.development.focused, true)
          } else if (extension.development.focused) {
            return set(extension, (ext) => ext.development.focused, false)
          }
          return extension
        }),
      }
    }

    case 'unfocus': {
      return {
        ...state,
        extensions: state.extensions.map((extension) => {
          if (extension.development.focused) {
            return set(extension, (ext) => ext.development.focused, false)
          }
          return extension
        }),
      }
    }

    default:
      return state
  }
}
