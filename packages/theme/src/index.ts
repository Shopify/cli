import CheckCommand from './cli/commands/theme/check.js'
import ConsoleCommand from './cli/commands/theme/console.js'
import DeleteCommand from './cli/commands/theme/delete.js'
import ListCommnd from './cli/commands/theme/list.js'

const COMMANDS = {
  'theme:check': CheckCommand,
  'theme:console': ConsoleCommand,
  'theme:delete': DeleteCommand,
  'theme:list': ListCommnd,
}

export default COMMANDS
