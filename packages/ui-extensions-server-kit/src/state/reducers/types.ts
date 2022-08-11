import type {App, ExtensionPayload} from '../../types'

export interface ExtensionServerState {
  app?: App
  extensions: ExtensionPayload[]
  store: string
}
