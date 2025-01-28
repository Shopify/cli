import {deepCompare} from '@shopify/cli-kit/common/object'
import {EventEmitter} from 'events'

export interface DevSessionStatus {
  isReady: boolean
  previewURL?: string
}

export class DevSessionStatusManager extends EventEmitter {
  private currentStatus: DevSessionStatus = {
    isReady: false,
    previewURL: undefined,
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

  get status(): DevSessionStatus {
    return this.currentStatus
  }

  reset() {
    this.currentStatus = {
      isReady: false,
      previewURL: undefined,
    }
  }
}
