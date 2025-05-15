import {ExtensionServer} from '../ExtensionServerClient/server-types.js'
import type {ExtensionServerState, ExtensionServerActions} from '../state'

export interface ExtensionServerContext {
  client: ExtensionServer.Client
  state: ExtensionServerState
  connect(options?: ExtensionServer.Options): void
  dispatch(action: ExtensionServerActions): void
}

export interface ExtensionServerProviderProps {
  children?: React.ReactNode
  options: ExtensionServer.Options
}
