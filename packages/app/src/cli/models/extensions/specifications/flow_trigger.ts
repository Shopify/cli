import {BaseSchema} from '../schemas.js'

import {createExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const FlowTriggerExtensionSchema = BaseSchema.extend({
  name: zod.string(),
  type: zod.literal('flow_trigger'),
  task: zod.object({
    title: zod.string(),
    description: zod.string(),
    fields: zod
      .array(
        zod.object({
          name: zod.string(),
          description: zod.string().optional(),
          id: zod.string(),
          ui_type: zod.string(),
        }),
      )
      .min(1),
  }),
})

/**
 * Extension specification with all properties and methods needed to load a Flow Trigger.
 */
const flowTriggerSpecification = createExtensionSpecification({
  identifier: 'flow_trigger',
  schema: FlowTriggerExtensionSchema,
  singleEntryPath: false,
  appModuleFeatures: (_) => [],
  deployConfig: async (config, _) => {
    return {
      title: config.task.title,
      description: config.task.description,
      fields: config.task.fields,
    }
  },
})

export default flowTriggerSpecification
