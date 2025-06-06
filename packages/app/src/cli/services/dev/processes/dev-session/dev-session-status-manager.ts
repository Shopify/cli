import {deepCompare} from '@shopify/cli-kit/common/object'
import {EventEmitter} from 'events'

export type DevSessionStatusMessageType = 'error' | 'success' | 'loading'

const DevSessionStaticMessages = {
  BUILD_ERROR: {message: 'Build error. Please review your code and try again', type: 'error'},
  READY: {message: 'Ready, watching for changes in your app', type: 'success'},
  LOADING: {message: 'Preparing app preview', type: 'loading'},
  UPDATED: {message: 'Updated', type: 'success'},
  VALIDATION_ERROR: {message: 'Validation error in your app configuration', type: 'error'},
  REMOTE_ERROR: {message: 'Error updating app preview', type: 'error'},
  CHANGE_DETECTED: {message: 'Change detected, updating app preview', type: 'loading'},
  BUILDING: {message: 'Building extensions', type: 'loading'},
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

  // List of all the logs that occurred in the current dev session.
  private readonly _logs: {timestamp: number; message: string; prefix?: string}[] = []

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

  addLog(log: {timestamp: number; message: string; prefix?: string}) {
    this._logs.push(log)
  }

  setMessage(message: keyof typeof DevSessionStaticMessages) {
    this.updateStatus({statusMessage: DevSessionStaticMessages[message]})
  }

  get status(): DevSessionStatus {
    return this.currentStatus
  }

  get logs(): {timestamp: number; message: string; prefix?: string}[] {
    return this._logs
  }

  setBuildingState(building: boolean) {
    const currentType = this.currentStatus.statusMessage?.type ?? 'success'
    const currentMessage = this.currentStatus.statusMessage?.message ?? ''

    if (building) {
      if (currentType === 'success' || currentType === 'error') {
        this.updateStatus({statusMessage: DevSessionStaticMessages.BUILDING})
      }
    } else if (currentMessage === 'Building extensions') {
      this.updateStatus({statusMessage: DevSessionStaticMessages.READY})
    }
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
