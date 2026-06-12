import StoreAuth from './cli/commands/store/auth.js'
import StoreExecute from './cli/commands/store/execute.js'
import StoreGraphiQL from './cli/commands/store/graphiql.js'
import StoreInfo from './cli/commands/store/info.js'

const COMMANDS = {
  'store:auth': StoreAuth,
  'store:execute': StoreExecute,
  'store:graphiql': StoreGraphiQL,
  'store:info': StoreInfo,
}

export default COMMANDS
