import {initiateLogging} from '../../log.js'
import {Hook} from '@oclif/core'

export const hook: Hook.Init = async (options) => {
  await initiateLogging()
}
