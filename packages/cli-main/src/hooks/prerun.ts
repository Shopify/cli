import {analytics} from '@shopify/cli-kit'
import {Hook} from '@oclif/core'

// This hook is called before each command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Prerun = async (_options) => {
  analytics.startTimer()
}
