import {Hook} from '@oclif/core'
import {output, store} from '@shopify/cli-kit'

// This hook is called before each command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Prerun = async (_options) => {
  await store.initializeCliKitStore()
  output.initiateLogging()
}
