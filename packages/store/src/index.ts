import Copy from './commands/store/copy.js'
import Create from './commands/store/create.js'
import List from './commands/store/list.js'

const COMMANDS = {
  'store:copy': Copy,
  'store:list': List,
  'store:create': Create,
}

export default COMMANDS
