import type {App, ExtensionPayload} from '../../types'

export type ActionType = 'connected' | 'update' | 'refresh' | 'focus' | 'unfocus'

export interface ExtensionServerState {
  app?: App
  extensions: ExtensionPayload[]
  store: string
  actionType?: ActionType
}
