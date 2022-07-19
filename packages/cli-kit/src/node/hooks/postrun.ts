import {reportEvent} from '../../analytics.js'
import {Hook} from '@oclif/core'

// This hook is called after each successful command run. More info: https://oclif.io/docs/hooks
export const hookPost: Hook.Postrun = async (_options) => {
  await reportEvent()
}
