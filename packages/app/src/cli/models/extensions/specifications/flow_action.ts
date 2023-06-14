import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'

import {zod} from '@shopify/cli-kit/node/schema'

const FlowActionExtensionSchema = BaseSchema.extend({
  name: zod.string(),
  type: zod.literal('flow_action'),
  task: zod.object({
    title: zod.string(),
    description: zod.string(),
    url: zod.string(),
    validationUrl: zod.string().optional(),
    customConfigurationPageUrl: zod.string().optional(),
    customConfigurationPagePreviewUrl: zod.string().optional(),
    fields: zod
      .array(
        zod.object({
          id: zod.string(),
          name: zod.string(),
          label: zod.string(),
          description: zod.string().optional(),
          required: zod.boolean(),
          uiType: zod.string(),
        }),
      )
      .optional(),
  }),
})

/**
 * Extension specification with all properties and methods needed to load a Flow Action.
 */
const flowActionSpecification = createExtensionSpecification({
  identifier: 'flow_action',
  schema: FlowActionExtensionSchema,
  singleEntryPath: false,
  appModuleFeatures: (_) => [],
  deployConfig: async (config, _) => {
    return {
      title: config.task.title,
      description: config.task.description,
      url: config.task.url,
      fields: config.task.fields,
      validation_url: config.task.validationUrl,
      custom_configuration_page_url: config.task.customConfigurationPageUrl,
      custom_configuration_page_preview_url: config.task.customConfigurationPagePreviewUrl,
    }
  },
})

export default flowActionSpecification
