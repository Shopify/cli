import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {validateNonCommerceObjectShape} from '../../../services/flow/validation.js'
import {serializeFields} from '../../../services/flow/serializeFields.js'
import {zod} from '@shopify/cli-kit/node/schema'

const FlowTriggerExtensionSchema = BaseSchema.extend({
  name: zod.string(),
  description: zod.string().optional(),
  type: zod.literal('flow_trigger'),
  extensions: zod
    .array(
      zod.object({
        type: zod.literal('flow_trigger'),
        schema: zod.string().optional(),
        return_type_ref: zod.string().optional(),
      }),
    )
    .min(1),
  settings: zod
    .object({
      fields: zod
        .array(
          zod
            .object({
              key: zod.string().optional(),
              description: zod.string().optional(),
              type: zod.string(),
            })
            .refine((field) => validateNonCommerceObjectShape(field, 'flow_trigger')),
        )
        .optional(),
    })
    .optional(),
})

/**
 * Extension specification with all properties and methods needed to load a Flow Trigger.
 */
const flowTriggerSpecification = createExtensionSpecification({
  identifier: 'flow_trigger',
  schema: FlowTriggerExtensionSchema,
  singleEntryPath: false,
  appModuleFeatures: (_) => [],
  deployConfig: async (config) => {
    const {extensions} = config
    const extension = extensions[0]!

    return {
      title: config.name,
      description: config.description,
      fields: serializeFields('flow_trigger', config.settings?.fields),
      schema: extension.schema,
      return_type_ref: extension.return_type_ref,
    }
  },
})

export default flowTriggerSpecification
