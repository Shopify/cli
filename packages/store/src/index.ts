import StoreAuth from './cli/commands/store/auth.js'
import StoreCreatePreview from './cli/commands/store/create/preview.js'
import StoreExecute from './cli/commands/store/execute.js'
import StoreInfo from './cli/commands/store/info.js'

const COMMANDS = {
  'store:auth': StoreAuth,
  'store:create:preview': StoreCreatePreview,
  'store:execute': StoreExecute,
  'store:info': StoreInfo,
}

export default COMMANDS
