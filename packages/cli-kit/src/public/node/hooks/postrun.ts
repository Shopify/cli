import {reportAnalyticsEvent} from '../analytics.js'
import {outputDebug} from '../../../public/node/output.js'
import {Hook} from '@oclif/core'

// This hook is called after each successful command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Postrun = async ({config, Command}) => {
  await reportAnalyticsEvent({config})
  const command = Command?.id?.replace(/:/g, ' ')
  outputDebug(`Completed command ${command}`)
}
