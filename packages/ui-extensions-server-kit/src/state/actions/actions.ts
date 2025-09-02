import type {ConnectedAction, UpdateAction, RefreshAction, FocusAction, UnfocusAction} from './types'

export function createConnectedAction(payload: ConnectedAction['payload']): ConnectedAction {
  return {
    type: 'connected',
    payload,
  }
}

export function createUpdateAction(payload: UpdateAction['payload']): UpdateAction {
  return {
    type: 'update',
    payload,
  }
}

export function createRefreshAction(payload: RefreshAction['payload']): RefreshAction {
  return {
    type: 'refresh',
    payload,
  }
}

export function createFocusAction(payload: FocusAction['payload']): FocusAction {
  return {
    type: 'focus',
    payload,
  }
}

export function createUnfocusAction(): UnfocusAction {
  return {
    type: 'unfocus',
  }
}
