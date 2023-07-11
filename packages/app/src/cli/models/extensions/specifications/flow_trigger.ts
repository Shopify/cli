import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {validateNonCommerceObjectShape} from '../../../services/flow/validation.js'
import {serializeFields} from '../../../services/flow/serialize-fields.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const FlowTriggerExtensionSchema = BaseSchema.extend({
  name: zod.string(),
  description: zod.string().optional(),
  type: zod.literal('flow_trigger'),
  extensions: zod
    .array(
      zod.object({
        type: zod.literal('flow_trigger'),
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
  // Flow doesn't have anything to bundle but we need to set this to true to
  // ensure that the extension configuration is uploaded after registration in
  // https://github.com/Shopify/cli/blob/73ac91c0f40be0a57d1b18cb34254b12d3a071af/packages/app/src/cli/services/deploy.ts#L107
  // Should be removed after unified deployment is 100% rolled out
  appModuleFeatures: (_) => ['bundling'],
  deployConfig: async (config) => {
    const {extensions} = config
    const extension = extensions[0]!

    return {
      title: config.name,
      description: config.description,
      fields: serializeFields('flow_trigger', config.settings?.fields),
    }
  },
})

export default flowTriggerSpecification
