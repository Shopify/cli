import StoreAuth from './cli/commands/store/auth.js'
import StoreExecute from './cli/commands/store/execute.js'
import StoreInfo from './cli/commands/store/info.js'

const COMMANDS = {
  'store:auth': StoreAuth,
  'store:execute': StoreExecute,
  'store:info': StoreInfo,
}

export default COMMANDS
