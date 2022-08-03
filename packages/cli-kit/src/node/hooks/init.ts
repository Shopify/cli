import {initiateLogging} from '../../output.js'
import {initializeCliKitStore} from '../../store.js'
import {Hook} from '@oclif/core'

export const hook: Hook.Init = async (options) => {
  await initializeCliKitStore()
  initiateLogging()
}
