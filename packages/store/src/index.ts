import Create from './commands/store/create.js'
import List from './commands/store/list.js'
import Delete from './commands/store/delete.js'

export const commands = {
  'store:list': List,
  'store:create': Create,
  'store:delete': Delete,
}
