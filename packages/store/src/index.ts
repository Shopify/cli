import FlowToolCall from './cli/commands/flow/tool/call.js'
import StoreAuth from './cli/commands/store/auth.js'
import StoreExecute from './cli/commands/store/execute.js'

const COMMANDS = {
  'flow:tool:call': FlowToolCall,
  'store:auth': StoreAuth,
  'store:execute': StoreExecute,
}

export default COMMANDS
