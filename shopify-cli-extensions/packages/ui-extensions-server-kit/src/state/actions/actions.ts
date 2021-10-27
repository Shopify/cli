import type { ConnectedAction, UpdateAction } from './types';

export function createConnectedAction(payload: ConnectedAction['payload']): ConnectedAction {
  return {
    type: 'connected',
    payload,
  };
}

export function createUpdateAction(payload: UpdateAction['payload']): UpdateAction {
  return {
    type: 'update',
    payload,
  };
}
