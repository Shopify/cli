import {BaseSchema} from '../schemas.js'

import {createExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const SUPPORTED_COMMERCE_OBJECTS = [
  'customer_reference',
  'order_reference',
  'product_reference',
  'marketing_activity_reference',
  'abandonment_reference',
]

interface ConfigField {
  type: string
  required: boolean
  key?: string | undefined
  name?: string | undefined
  description?: string | undefined
}

const validateCommerceObject = (configField: ConfigField) => {
  if (!SUPPORTED_COMMERCE_OBJECTS.includes(configField.type)) {
    if (!configField.key) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['settings.fields.key'],
          message: 'Key must be speicified for non-commerce object fields',
        },
      ])
    }

    if (!configField.name) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['settings.fields.name'],
          message: 'Name must be speicified for non-commerce object fields',
        },
      ])
    }
  }
}

const FlowTriggerExtensionSchema = BaseSchema.extend({
  name: zod.string(),
  description: zod.string().optional(),
  type: zod.literal('flow_action'),
  extensions: zod
    .array(
      zod.object({
        runtime_url: zod.string(),
        validation_url: zod.string().optional(),
        config_page_url: zod.string().optional(),
        config_page_preview_url: zod.string().optional(),
        schema: zod.string().optional(),
        return_type_ref: zod.string().optional(),
      }),
    )
    .min(1),
  settings: zod.object({
    fields: zod
      .array(
        zod
          .object({
            key: zod.string().optional(),
            name: zod.string().optional(),
            description: zod.string().optional(),
            required: zod.boolean(),
            type: zod.string(),
          })
          .refine(validateCommerceObject),
      )
      .optional(),
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
      title: config.name,
      description: config.description,
      fields: config.settings.fields,
    }
  },
})

export default flowTriggerSpecification
