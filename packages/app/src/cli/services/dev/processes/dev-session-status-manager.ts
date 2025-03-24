import {deepCompare} from '@shopify/cli-kit/common/object'
import {EventEmitter} from 'events'

export type DevSessionStatusMessageType = 'error' | 'success' | 'loading'

const DevSessionStaticMessages = {
  BUILD_ERROR: {message: 'Build error. Please review your code and try again', type: 'error'},
  READY: {message: 'Ready, watching for changes in your app', type: 'success'},
  LOADING: {message: 'Preparing dev session', type: 'loading'},
  UPDATED: {message: 'Updated', type: 'success'},
  VALIDATION_ERROR: {message: 'Validation error in your app configuration', type: 'error'},
  REMOTE_ERROR: {message: 'Error updating dev session', type: 'error'},
  CHANGE_DETECTED: {message: 'Change detected, updating dev session', type: 'loading'},
} as const

export interface DevSessionStatus {
  isReady: boolean
  previewURL?: string
  graphiqlURL?: string
  statusMessage?: {message: string; type: DevSessionStatusMessageType}
}

export class DevSessionStatusManager extends EventEmitter {
  private currentStatus: DevSessionStatus = {
    isReady: false,
    previewURL: undefined,
    graphiqlURL: undefined,
    statusMessage: undefined,
  }

  constructor(defaultStatus?: DevSessionStatus) {
    super()
    if (defaultStatus) this.currentStatus = defaultStatus
  }

  updateStatus(status: Partial<DevSessionStatus>) {
    const newStatus = {...this.currentStatus, ...status}
    // Only emit if status has changed
    const statusIsEqual = deepCompare(this.currentStatus, newStatus)
    if (statusIsEqual) return
    this.currentStatus = newStatus
    this.emit('dev-session-update', newStatus)
  }

  setMessage(message: keyof typeof DevSessionStaticMessages) {
    this.updateStatus({statusMessage: DevSessionStaticMessages[message]})
  }

  get status(): DevSessionStatus {
    return this.currentStatus
  }

  reset() {
    this.currentStatus = {
      isReady: false,
      previewURL: undefined,
      graphiqlURL: undefined,
      statusMessage: undefined,
    }
  }
}
