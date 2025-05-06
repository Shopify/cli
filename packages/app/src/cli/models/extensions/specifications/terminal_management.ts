import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const TerminalManagementSchema = BaseSchema.extend({
  terminals_url: zod.string(),
  terminal_status_url: zod.string(),
  terminal_diagnostic_page_url: zod.string(),
})

const spec = createExtensionSpecification({
  identifier: 'terminal_management',
  schema: TerminalManagementSchema,
  appModuleFeatures: (_) => [],
  deployConfig: async (config, _) => {
    return {
      terminals_url: config.terminals_url,
      terminal_status_url: config.terminal_status_url,
      terminal_diagnostic_page_url: config.terminal_diagnostic_page_url,
    }
  },
})

export default spec
