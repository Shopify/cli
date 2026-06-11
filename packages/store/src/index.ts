import StoreAuth from './cli/commands/store/auth.js'
import StoreCreateDev from './cli/commands/store/create/dev.js'
import StoreCreatePreview from './cli/commands/store/create/preview.js'
import StoreExecute from './cli/commands/store/execute.js'
import StoreInfo from './cli/commands/store/info.js'
import StoreList from './cli/commands/store/list.js'

const COMMANDS = {
  'store:auth': StoreAuth,
  'store:create:dev': StoreCreateDev,
  'store:create:preview': StoreCreatePreview,
  'store:execute': StoreExecute,
  'store:info': StoreInfo,
  'store:list': StoreList,
}

export default COMMANDS
