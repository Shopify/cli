import {hook as deprecationsHook} from './postrun/deprecations.js'
import {Hook} from '@oclif/core'

// This hook is called after each successful command run. More info: https://oclif.io/docs/hooks
const hook: Hook.Postrun = async ({config, Command}) => {
  deprecationsHook(Command)
}

export default hook
