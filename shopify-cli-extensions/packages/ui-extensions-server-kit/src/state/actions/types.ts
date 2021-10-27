export interface ConnectedAction {
  type: 'connected';
  payload: ExtensionServer.InboundEvents['connected'];
}

export interface UpdateAction {
  type: 'update';
  payload: ExtensionServer.InboundEvents['update'];
}

export type ExtensionServerActions = ConnectedAction | UpdateAction;
