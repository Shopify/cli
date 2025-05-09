import {getDependencyVersion} from '../../app/app.js'
import {createExtensionSpecification} from '../specification.js'
import {BaseSchema, MetafieldSchema} from '../schemas.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {zod} from '@shopify/cli-kit/node/schema'

const dependency = '@shopify/retail-ui-extensions'

const posUISpec = createExtensionSpecification({
  identifier: 'pos_ui_extension',
  dependency,
  schema: BaseSchema.extend({
    name: zod.string(),
    metafields: zod.array(MetafieldSchema).optional(),
  }),
  appModuleFeatures: (_) => ['ui_preview', 'bundling', 'esbuild', 'single_js_entry_path'],
  deployConfig: async (config, directory) => {
    const result = await getDependencyVersion(dependency, directory)
    if (result === 'not_found') throw new BugError(`Dependency ${dependency} not found`)
    return {
      name: config.name,
      description: config.description,
      renderer_version: result?.version,
    }
  },
})

export default posUISpec
