import StoreAuth from './cli/commands/store/auth.js'
import StoreStripeAuth from './cli/commands/store/stripe-auth.js'
import StoreCreateDev from './cli/commands/store/create/dev.js'
import StoreExecute from './cli/commands/store/execute.js'
import StoreInfo from './cli/commands/store/info.js'

const COMMANDS = {
  'store:auth': StoreAuth,
  'store:stripe-auth': StoreStripeAuth,
  'store:create:dev': StoreCreateDev,
  'store:execute': StoreExecute,
  'store:info': StoreInfo,
}

export default COMMANDS
