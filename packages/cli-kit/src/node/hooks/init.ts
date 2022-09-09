import {initiateLogging} from '../../output.js'
import {Hook} from '@oclif/core'

export const hook: Hook.Init = async (options) => {
  initiateLogging()
}
