import {deepCompare} from '@shopify/cli-kit/common/object'
import {EventEmitter} from 'events'

export interface DevSessionStatus {
  isReady: boolean
  previewURL?: string
  graphiqlUrl?: string
}

/**
 * This class handles status updates between the DevSession and the Dev UI renderer.
 *
 * When there is a dev-session update that should be reflected in the UI,
 * the DevSessionStatusManager will emit an event that the Dev UI renderer will listen for.
 */
export class DevSessionStatusManager extends EventEmitter {
  private currentStatus: DevSessionStatus = {
    isReady: false,
    previewURL: undefined,
    graphiqlUrl: undefined,
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
      graphiqlUrl: undefined,
    }
  }
}
