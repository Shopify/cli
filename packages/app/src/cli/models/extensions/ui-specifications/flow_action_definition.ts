import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'

import {zod} from '@shopify/cli-kit/node/schema'

const FlowExtensionSchema = BaseUIExtensionSchema.extend({
  name: zod.string(),
  type: zod.literal('flow_action_definition'),
})

/**
 * Extension specification with all properties and methods needed to load a theme extension.
 */
const themeSpecification = createUIExtensionSpecification({
  identifier: 'flow_action_definition',
  // these two fields are going to be overridden by the extension specification API response,
  // but we need them to have a default value for tests
  schema: FlowExtensionSchema,
  supportedFlavors: [],
  singleEntryPath: false,
  deployConfig: async (config, _) => {
    return {}
  },
})

export default themeSpecification
