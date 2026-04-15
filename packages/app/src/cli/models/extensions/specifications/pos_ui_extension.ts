import {getDependencyVersion} from '../../app/app.js'
import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {ExtensionInstance} from '../extension-instance.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {zod} from '@shopify/cli-kit/node/schema'

const dependency = '@shopify/retail-ui-extensions'

type PosUIConfigType = zod.infer<typeof PosUISchema>
const PosUISchema = BaseSchema.extend({name: zod.string()})

const posUISpec = createExtensionSpecification({
  identifier: 'pos_ui_extension',
  dependency,
  schema: PosUISchema,
  appModuleFeatures: (_) => ['ui_preview', 'esbuild', 'single_js_entry_path'],
  buildConfig: {mode: 'ui'},
  getOutputRelativePath: (extension: ExtensionInstance<PosUIConfigType>) => `dist/${extension.handle}.js`,
  clientSteps: [
    {
      lifecycle: 'deploy',
      steps: [{id: 'bundle-ui', name: 'Bundle UI Extension', type: 'bundle_ui', config: {}}],
    },
  ],
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
