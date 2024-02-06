import {loadSchemaFromPath} from '../../../services/flow/utils.js'
import {BaseSchemaWithHandle, FieldSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {validateFieldShape, validateTriggerSchemaPresence} from '../../../services/flow/validation.js'
import {serializeFields} from '../../../services/flow/serialize-fields.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const FlowTriggerSettingsSchema = FieldSchema.extend({
  key: zod
    .string()
    .regex(/^[a-zA-Z\s]*$/, {
      message: 'String must contain only alphabetic characters and spaces',
    })
    .optional(),
})

const FlowTriggerExtensionSchema = BaseSchemaWithHandle.extend({
  type: zod.literal('flow_trigger'),
  schema: zod.string().optional(),
  settings: zod
    .object({
      fields: zod.array(FlowTriggerSettingsSchema).optional(),
    })
    .optional(),
}).refine((config) => {
  const fields = config.settings?.fields ?? []
  const settingsFieldsAreValid = fields.every((field, index) =>
    validateFieldShape(field, 'flow_trigger', config.handle, index),
  )
  const schemaPresenceIsValid = validateTriggerSchemaPresence(fields, config.schema)

  return settingsFieldsAreValid && schemaPresenceIsValid
})

/**
 * Extension specification with all properties and methods needed to load a Flow Trigger.
 */
const flowTriggerSpecification = createExtensionSpecification({
  identifier: 'flow_trigger',
  schema: FlowTriggerExtensionSchema,
  // Flow doesn't have anything to bundle but we need to set this to true to
  // ensure that the extension configuration is uploaded after registration in
  // https://github.com/Shopify/cli/blob/73ac91c0f40be0a57d1b18cb34254b12d3a071af/packages/app/src/cli/services/deploy.ts#L107
  // Should be removed after unified deployment is 100% rolled out
  appModuleFeatures: (_) => ['bundling'],
  deployConfig: async (config, extensionPath) => {
    return {
      title: config.name,
      description: config.description,
      fields: serializeFields('flow_trigger', config.settings?.fields),
      schema_patch: await loadSchemaFromPath(extensionPath, config.schema),
    }
  },
})

export default flowTriggerSpecification
