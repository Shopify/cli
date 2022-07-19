import constants from '../../constants.js'
import {debug, initiateLogging} from '../../output.js'
import {Hook} from '@oclif/core'

export const hook: Hook.Init = async (options) => {
  initiateLogging({filename: constants.logStreams.cli})
  const command = options.id?.replace(/:/g, ' ')
  debug(`Running command ${command}`)
}
