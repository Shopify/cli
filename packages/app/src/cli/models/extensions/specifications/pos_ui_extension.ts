import {getDependencyVersion} from '../../app/app.js'
import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {BugError} from '@shopify/cli-kit/node/error'

const dependency = '@shopify/retail-ui-extensions'

const spec = createExtensionSpecification({
  identifier: 'pos_ui_extension',
  surface: 'pos',
  dependency,
  partnersWebIdentifier: 'pos_ui_extension',
  schema: BaseSchema,
  isPreviewable: true,
  appModuleFeatures: (_) => ['ui_legacy', 'bundling'],
  deployConfig: async (config, directory) => {
    const result = await getDependencyVersion(dependency, directory)
    if (result === 'not_found') throw new BugError(`Dependency ${dependency} not found`)
    return {
      name: config.name,
      description: config.description,
      renderer_version: result?.version,
    }
  },
  previewMessage: () => undefined,
})

export default spec
