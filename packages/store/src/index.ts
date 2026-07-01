import StoreAuthList from './cli/commands/store/auth/list.js'
import StoreAuth from './cli/commands/store/auth.js'
import StoreBulkCancel from './cli/commands/store/bulk/cancel.js'
import StoreBulkExecute from './cli/commands/store/bulk/execute.js'
import StoreBulkStatus from './cli/commands/store/bulk/status.js'
import StoreCreateDev from './cli/commands/store/create/dev.js'
import StoreCreatePreview from './cli/commands/store/create/preview.js'
import StoreExecute from './cli/commands/store/execute.js'
import StoreInfo from './cli/commands/store/info.js'
import StoreList from './cli/commands/store/list.js'
import StoreOpen from './cli/commands/store/open.js'

export {loadAdminSessionFromStoreAuth} from './cli/services/store/auth/admin-session.js'

const COMMANDS = {
  'store:auth:list': StoreAuthList,
  'store:auth': StoreAuth,
  'store:bulk:cancel': StoreBulkCancel,
  'store:bulk:execute': StoreBulkExecute,
  'store:bulk:status': StoreBulkStatus,
  'store:create:dev': StoreCreateDev,
  'store:create:preview': StoreCreatePreview,
  'store:execute': StoreExecute,
  'store:info': StoreInfo,
  'store:list': StoreList,
  'store:open': StoreOpen,
}

export default COMMANDS
