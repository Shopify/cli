import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'

import {zod} from '@shopify/cli-kit/node/schema'

// TODO: we need to figure out if we can do inter field validation (e.g. CCP requires Preview and validation URLs)
const FlowActionDefinitionExtensionSchema = BaseUIExtensionSchema.extend({
  name: zod.string(),
  type: zod.literal('flow_action_definition'),
  task: zod.object({
    title: zod.string(),
    description: zod.string(),
    url: zod.string(),
    validationUrl: zod.string().optional(),
    customConfigurationPageUrl: zod.string().optional(),
    customConfigurationPagePreviewUrl: zod.string().optional(),
    fields: zod.array(
      zod.object({
        id: zod.string(),
        name: zod.string(),
        label: zod.string(),
        description: zod.string().optional(),
        required: zod.boolean(),
        uiType: zod.string(),
      }),
    ),
  }),
})

/**
 * Extension specification with all properties and methods needed to load a UI extension.
 */
const flowActionDefinitionSpecification = createUIExtensionSpecification({
  identifier: 'flow_action_definition',
  schema: FlowActionDefinitionExtensionSchema,
  supportedFlavors: [],
  singleEntryPath: false,
  deployConfig: async (config, _) => {
    // TODO: we'll need to figure out a solution for how we manage generating UUIDs for fields
    // we can either ask the partner to provide them, or we can generate them for them but we'll need to update the config file
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

export default flowActionDefinitionSpecification
