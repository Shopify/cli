import {extensionServerReducer, INITIAL_STATE} from '../state/index.js'
import {useReducer} from 'react'

export function useExtensionServerState() {
  return useReducer(extensionServerReducer, INITIAL_STATE)
}
