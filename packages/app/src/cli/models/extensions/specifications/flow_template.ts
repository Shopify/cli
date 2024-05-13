import {BaseSchemaWithHandle} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const FlowTemplateExtensionSchema = BaseSchemaWithHandle.extend({
  type: zod.literal('flow_template'),
  description: zod.string().max(1024),
  template: zod.object({
    categories: zod.array(zod.string()),
    module: zod.string(),
    require_app: zod.boolean().optional(),
    discoverable: zod.boolean().optional(),
    allow_one_click_activate: zod.boolean().optional(),
    enabled: zod.boolean().optional(),
  }),
})

const flowTemplateSpec = createExtensionSpecification({
  identifier: 'flow_template',
  schema: FlowTemplateExtensionSchema,
  appModuleFeatures: (_) => ['bundling'],
  deployConfig: async (config, _) => {
    return {
      template_handle: config.handle,
      name: config.name,
      description: config.description,
      categories: config.template.categories,
      require_app: config.template.require_app,
      discoverable: config.template.discoverable,
      allow_one_click_activate: config.template.allow_one_click_activate,
      enabled: config.template.enabled,
    }
  },
})

export default flowTemplateSpec
