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
  title: zod.string(),
  description: zod.string(),
  categories: zod.array(zod.string()),
  require_app: zod.boolean(),
  visible: zod.boolean(),
  enabled: zod.boolean(),
})

const spec = createExtensionSpecification({
  identifier: 'flow_template',
  schema: FlowTemplateExtensionSchema,
  singleEntryPath: false,
  appModuleFeatures: (_) => ['bundling'],
  deployConfig: async (config, extensionPath) => {
    return {
      title: config.title,
      handle: config.handle,
      description: config.description,
      uuid: config.handle,
      categories: config.categories,
      require_app: config.require_app,
      visible: config.visible,
      enabled: config.enabled,
      localization: await loadLocalesConfig(extensionPath, 'flow_template'),
      definition: await loadWorkflow(extensionPath, config.handle),
    }
  },
})

async function loadWorkflow(path: string, handle: string) {
  const flowFilePaths = await glob(joinPath(path, '/template.flow'))
  const flowFilePath = flowFilePaths[0]

  if (!flowFilePath) {
    throw new AbortError(
      `Missing .flow file in ${path} `,
      'Make sure you have built and exported a flow file from a Shop.',
    )
  } else if (flowFilePaths.length > 1) {
    throw new AbortError(
      `More than one .flow file found in ${path} `,
      'Make sure you have only one .flow file in your extension folder.',
    )
  }

  return fs.readFileSync(flowFilePath, 'base64')
}

export default spec
