import {reportEvent} from '../../../analytics.js'
import {debug} from '../../../output.js'
import {Hook} from '@oclif/core'

// This hook is called after each successful command run. More info: https://oclif.io/docs/hooks
export const hookPost: Hook.Postrun = async ({config, Command}) => {
  await reportEvent({config})
  const command = Command?.id?.replace(/:/g, ' ')
  debug(`Completed command ${command}`)
}
