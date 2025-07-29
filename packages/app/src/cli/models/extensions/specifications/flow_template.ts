import {BaseSchemaWithHandle} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'
import {AbortError} from '@shopify/cli-kit/node/error'
import {glob} from '@shopify/cli-kit/node/fs'
import fs from 'fs'

const VALID_CATEGORIES = [
  'buyer_experience',
  'customers',
  'fulfillment',
  'inventory_and_merch',
  'loyalty',
  'orders',
  'promotion',
  'risk',
  'b2b',
  'payment_reminders',
  'custom_data',
  'error_monitoring',
]

const FLOW_TEAM_CATEGORIES = ['capture_at_fulfillment']

const FlowTemplateExtensionSchema = BaseSchemaWithHandle.extend({
  type: zod.literal('flow_template'),
  name: zod.string(),
  description: zod.string().max(1024),
  template: zod.object({
    categories: zod.array(
      zod.string().refine((category) => VALID_CATEGORIES.concat(FLOW_TEAM_CATEGORIES).includes(category), {
        message: `Invalid category. Valid categories include: ${VALID_CATEGORIES.join(', ')}.`,
      }),
    ),
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
  appModuleFeatures: (_) => ['ui_preview', 'bundling'],
  deployConfig: async (config, extensionPath) => {
    const typedConfig = config as zod.infer<typeof FlowTemplateExtensionSchema>
    return {
      template_handle: typedConfig.handle,
      name: typedConfig.name,
      description: typedConfig.description,
      categories: typedConfig.template.categories,
      require_app: typedConfig.template.require_app,
      discoverable: typedConfig.template.discoverable,
      allow_one_click_activate: typedConfig.template.allow_one_click_activate,
      enabled: typedConfig.template.enabled,
      definition: await loadWorkflow(extensionPath, typedConfig.template.module),
      localization: await loadLocalesConfig(extensionPath, typedConfig.name ?? ''),
    }
  },
})

async function loadWorkflow(path: string, workflowPath: string) {
  const flowFilePaths = await glob(joinPath(path, workflowPath))
  const flowFilePath = flowFilePaths[0]
  if (!flowFilePath) {
    throw new AbortError(`Missing flow file with the path ${joinPath(path, workflowPath)}`)
  }
  return fs.readFileSync(flowFilePath, 'base64')
}

export default flowTemplateSpec
