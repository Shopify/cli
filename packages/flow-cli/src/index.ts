/**
 * Standalone Flow CLI command registry.
 *
 * Command IDs here have no 'flow:' prefix because 'flow' is the binary name.
 * The equivalent hidden command in the Shopify CLI would be 'flow:workflow:list';
 * here it is just 'workflow:list', invoked as `flow workflow list`.
 *
 * To wire in the full command set from the flow branches:
 *   1. Add @shopify/store as a workspace dependency
 *   2. Import commands from their source files and re-export here without the flow: prefix
 */
import WorkflowList from './cli/commands/workflow/list.js'
import WorkflowPull from './cli/commands/workflow/pull.js'

const COMMANDS = {
  'workflow:list': WorkflowList,
  'workflow:pull': WorkflowPull,
}

export default COMMANDS
