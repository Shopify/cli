import StoreAuth from './cli/commands/store/auth.js'
import StoreCreateTrial from './cli/commands/store/create/trial.js'
import StoreExecute from './cli/commands/store/execute.js'

const COMMANDS = {
  'store:auth': StoreAuth,
  'store:create:trial': StoreCreateTrial,
  'store:execute': StoreExecute,
}

export default COMMANDS
