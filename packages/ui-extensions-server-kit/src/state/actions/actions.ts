import type {ConnectedAction, UpdateAction, RefreshAction, FocusAction, UnfocusAction, LogAction} from './types'

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

export function createUnfocusAction(payload: UnfocusAction['payload']): UnfocusAction {
  return {
    type: 'unfocus',
    payload,
  }
}

export function createLogAction(payload: LogAction['payload']): LogAction {
  return {
    type: 'log',
    payload,
  }
}
