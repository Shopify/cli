export interface ConnectedAction {
  type: 'connected'
  payload: ExtensionServer.InboundEvents['connected']
}

export interface UpdateAction {
  type: 'update'
  payload: ExtensionServer.InboundEvents['update']
}

export interface RefreshAction {
  type: 'refresh'
  payload: ExtensionServer.InboundEvents['refresh']
}

export interface FocusAction {
  type: 'focus'
  payload: ExtensionServer.InboundEvents['focus']
}

export interface UnfocusAction {
  type: 'unfocus'
}

export type ExtensionServerActions = ConnectedAction | UpdateAction | RefreshAction | FocusAction | UnfocusAction
