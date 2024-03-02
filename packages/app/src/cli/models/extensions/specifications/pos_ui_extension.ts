import {getDependencyVersion} from '../../app/app.js'
import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {BugError} from '@shopify/cli-kit/node/error'

const dependency = '@shopify/retail-ui-extensions'

const posUISpec = createExtensionSpecification({
  identifier: 'pos_ui_extension',
  dependency,
  schema: BaseSchema,
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
