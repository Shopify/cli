import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'

import {zod} from '@shopify/cli-kit/node/schema'

const FlowTriggerDefinitionExtensionSchema = BaseUIExtensionSchema.extend({
  name: zod.string(),
  type: zod.literal('flow_trigger_definition'),
  title: zod.string(),
  description: zod.string(),
  fields: zod.array(zod.object({})),
})

/**
 * Extension specification with all properties and methods needed to load a UI extension.
 */
const flowActionDefinitionSpecification = createUIExtensionSpecification({
  identifier: 'flow_trigger_definition',
  schema: FlowTriggerDefinitionExtensionSchema,
  supportedFlavors: [],
  singleEntryPath: false,
  deployConfig: async (config, _) => {
    return {
      title: config.title,
      description: config.description,
      fields: config.fields,
    }
  },
})

export default flowActionDefinitionSpecification
