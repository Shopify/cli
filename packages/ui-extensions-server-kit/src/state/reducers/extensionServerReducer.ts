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
        extension.extensionPoints?.forEach((extPoint, i) => {
          if (!extPoint || typeof extPoint === 'string') return

          Object.keys(extPoint.assets || {}).forEach(
            // @ts-expect-error should be okay
            (asset) => {
              extension.extensionPoints[i].assets[asset].url = assetToString(extPoint.assets[asset])
              debugger
            },
          )
        })
        return extension
      })
      return {
        ...state,
        store: action.payload.store,
        app: action.payload.app,
        extensions,
      } as ExtensionServerState
    }

    case 'update': {
      const extensions = (action.payload.extensions ?? []).map((extension) => {
        Object.keys(extension.assets).forEach(
          (asset) => (extension.assets[asset].url = assetToString(extension.assets[asset])),
        )
        extension.extensionPoints?.forEach((extPoint, i) => {
          if (!extPoint || typeof extPoint === 'string') return

          Object.keys(extPoint.assets || {}).forEach(
            // @ts-expect-error should be okay
            (asset) => (extension.extensionPoints[i].assets[asset].url = assetToString(extPoint.assets[asset])),
          )
        })
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

            const extensionPoints = extension.extensionPoints?.map((extPoint) => {
              if (extPoint && typeof extPoint === 'object') {
                const assets: ExtensionPayload['assets'] = {}
                Object.keys(extPoint.assets || {}).forEach((asset) => {
                  if (!extPoint.assets) return

                  assets[asset] = {
                    ...extPoint.assets[asset],
                    lastUpdated: Date.now(),
                    url: assetToString(extPoint.assets[asset]),
                  }
                })

                return {...extPoint, assets}
              }

              return extPoint
            })

            return {...extension, assets, extensionPoints} as ExtensionPayload
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
