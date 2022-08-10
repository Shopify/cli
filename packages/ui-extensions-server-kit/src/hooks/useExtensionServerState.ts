import {extensionServerReducer, INITIAL_STATE} from '../state'
import {useReducer} from 'react'

export function useExtensionServerState() {
  return useReducer(extensionServerReducer, INITIAL_STATE)
}
