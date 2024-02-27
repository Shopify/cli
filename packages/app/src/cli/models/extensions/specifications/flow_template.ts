import {BaseSchemaWithHandle} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'
import {AbortError} from '@shopify/cli-kit/node/error'
import {glob} from '@shopify/cli-kit/node/fs'
import fs from 'fs'

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
  deployConfig: async (config, extensionPath) => {
    return {
      template_handle: config.handle,
      name: config.name,
      description: config.description,
      categories: config.template.categories,
      require_app: config.template.require_app,
      discoverable: config.template.discoverable,
      allow_one_click_activate: config.template.allow_one_click_activate,
      enabled: config.template.enabled,
      definition: await loadWorkflow(extensionPath, config.template.module),
      localization: await loadLocalesConfig(extensionPath, config.name),
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
