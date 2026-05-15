import StoreAuth from './cli/commands/store/auth.js'
import StoreExecute from './cli/commands/store/execute.js'

export {importStoreAuthBootstrap, type StoreAuthBootstrap} from './cli/services/store/auth/bootstrap.js'

const COMMANDS = {
  'store:auth': StoreAuth,
  'store:execute': StoreExecute,
}

export default COMMANDS
