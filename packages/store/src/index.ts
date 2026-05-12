import FlowEnvSearch from './cli/commands/flow/env/search.js'
import FlowInit from './cli/commands/flow/init.js'
import FlowResourceSearch from './cli/commands/flow/resource/search.js'
import FlowShopifyqlColumns from './cli/commands/flow/shopifyql/columns.js'
import FlowTaskDescribe from './cli/commands/flow/task/describe.js'
import FlowTaskSearch from './cli/commands/flow/task/search.js'
import FlowTemplateSave from './cli/commands/flow/template/save.js'
import FlowTemplateSearch from './cli/commands/flow/template/search.js'
import FlowTypeShow from './cli/commands/flow/type/show.js'
import FlowWorkflowActivate from './cli/commands/flow/workflow/activate.js'
import FlowWorkflowDeactivate from './cli/commands/flow/workflow/deactivate.js'
import FlowWorkflowDiff from './cli/commands/flow/workflow/diff.js'
import FlowWorkflowList from './cli/commands/flow/workflow/list.js'
import FlowWorkflowPreview from './cli/commands/flow/workflow/preview.js'
import FlowWorkflowPull from './cli/commands/flow/workflow/pull.js'
import FlowWorkflowPush from './cli/commands/flow/workflow/push.js'
import FlowWorkflowShow from './cli/commands/flow/workflow/show.js'
import FlowWorkflowStatus from './cli/commands/flow/workflow/status.js'
import FlowWorkflowValidate from './cli/commands/flow/workflow/validate.js'
import StoreAuth from './cli/commands/store/auth.js'
import StoreExecute from './cli/commands/store/execute.js'

const COMMANDS = {
  'flow:env:search': FlowEnvSearch,
  'flow:init': FlowInit,
  'flow:resource:search': FlowResourceSearch,
  'flow:shopifyql:columns': FlowShopifyqlColumns,
  'flow:task:describe': FlowTaskDescribe,
  'flow:task:search': FlowTaskSearch,
  'flow:template:save': FlowTemplateSave,
  'flow:template:search': FlowTemplateSearch,
  'flow:type:show': FlowTypeShow,
  'flow:workflow:activate': FlowWorkflowActivate,
  'flow:workflow:deactivate': FlowWorkflowDeactivate,
  'flow:workflow:diff': FlowWorkflowDiff,
  'flow:workflow:list': FlowWorkflowList,
  'flow:workflow:preview': FlowWorkflowPreview,
  'flow:workflow:pull': FlowWorkflowPull,
  'flow:workflow:push': FlowWorkflowPush,
  'flow:workflow:show': FlowWorkflowShow,
  'flow:workflow:status': FlowWorkflowStatus,
  'flow:workflow:validate': FlowWorkflowValidate,
  'store:auth': StoreAuth,
  'store:execute': StoreExecute,
}

export default COMMANDS
