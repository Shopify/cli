import FlowEnvSearch from './cli/commands/env/search.js'
import FlowInit from './cli/commands/init.js'
import FlowResourceSearch from './cli/commands/resource/search.js'
import FlowShopifyqlColumns from './cli/commands/shopifyql/columns.js'
import FlowTaskDescribe from './cli/commands/task/describe.js'
import FlowTaskSearch from './cli/commands/task/search.js'
import FlowTemplateSave from './cli/commands/template/save.js'
import FlowTemplateSearch from './cli/commands/template/search.js'
import FlowTypeShow from './cli/commands/type/show.js'
import FlowWorkflowActivate from './cli/commands/workflow/activate.js'
import FlowWorkflowDeactivate from './cli/commands/workflow/deactivate.js'
import FlowWorkflowDiff from './cli/commands/workflow/diff.js'
import FlowWorkflowList from './cli/commands/workflow/list.js'
import FlowWorkflowPreview from './cli/commands/workflow/preview.js'
import FlowWorkflowPull from './cli/commands/workflow/pull.js'
import FlowWorkflowPush from './cli/commands/workflow/push.js'
import FlowWorkflowShow from './cli/commands/workflow/show.js'
import FlowWorkflowStatus from './cli/commands/workflow/status.js'
import FlowWorkflowValidate from './cli/commands/workflow/validate.js'

/**
 * Explicit command registry for \@shopify/flow-cli.
 * Command IDs have no 'flow:' prefix — 'flow' is the binary name.
 * Consumed by oclif's "explicit" strategy via package.json#oclif.commands.
 */
const COMMANDS = {
  'env:search': FlowEnvSearch,
  init: FlowInit,
  'resource:search': FlowResourceSearch,
  'shopifyql:columns': FlowShopifyqlColumns,
  'task:describe': FlowTaskDescribe,
  'task:search': FlowTaskSearch,
  'template:save': FlowTemplateSave,
  'template:search': FlowTemplateSearch,
  'type:show': FlowTypeShow,
  'workflow:activate': FlowWorkflowActivate,
  'workflow:deactivate': FlowWorkflowDeactivate,
  'workflow:diff': FlowWorkflowDiff,
  'workflow:list': FlowWorkflowList,
  'workflow:preview': FlowWorkflowPreview,
  'workflow:pull': FlowWorkflowPull,
  'workflow:push': FlowWorkflowPush,
  'workflow:show': FlowWorkflowShow,
  'workflow:status': FlowWorkflowStatus,
  'workflow:validate': FlowWorkflowValidate,
}

export default COMMANDS
