import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'

import {zod} from '@shopify/cli-kit/node/schema'

const FlowTriggerDefinitionExtensionSchema = BaseUIExtensionSchema.extend({
  name: zod.string(),
  type: zod.literal('flow_trigger_definition'),
  task: zod.object({
    title: zod.string(),
    description: zod.string(),
    fields: zod.array(
      zod.object({
        name: zod.string(),
        description: zod.string().optional(),
        id: zod.string(),
        uiType: zod.string(),
      }),
    ),
  }),
})

/**
 * Extension specification with all properties and methods needed to load a UI extension.
 */
const flowTriggerDefinitionSpecification = createUIExtensionSpecification({
  identifier: 'flow_trigger_definition',
  schema: FlowTriggerDefinitionExtensionSchema,
  supportedFlavors: [],
  singleEntryPath: false,
  deployConfig: async (config, _) => {
    return {
      title: config.task.title,
      description: config.task.description,
      fields: config.task.fields,
    }
  },
})

export default flowTriggerDefinitionSpecification
