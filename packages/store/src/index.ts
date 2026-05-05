import StoreAuth from './cli/commands/store/auth.js'
import StoreCreateDev from './cli/commands/store/create/dev.js'
import StoreDelete from './cli/commands/store/delete.js'
import StoreExecute from './cli/commands/store/execute.js'

const COMMANDS = {
  'store:auth': StoreAuth,
  'store:create:dev': StoreCreateDev,
  'store:delete': StoreDelete,
  'store:execute': StoreExecute,
}

export default COMMANDS
