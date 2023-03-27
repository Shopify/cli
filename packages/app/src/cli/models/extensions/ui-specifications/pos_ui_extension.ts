import {getDependencyVersion} from '../../app/app.js'
import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'
import {BugError} from '@shopify/cli-kit/node/error'

const dependency = {name: '@shopify/retail-ui-extensions-react', version: '^0.44.0'}

const spec = createUIExtensionSpecification({
  identifier: 'pos_ui_extension',
  surface: 'pos',
  dependency,
  partnersWebIdentifier: 'pos_ui_extension',
  schema: BaseUIExtensionSchema,
  deployConfig: async (config, directory) => {
    const result = await getDependencyVersion(dependency.name, directory)
    if (result === 'not_found') throw new BugError(`Dependency ${dependency.name} not found`)
    return {
      name: config.name,
      description: config.description,
      renderer_version: result?.version,
    }
  },
  previewMessage: () => undefined,
})

export default spec
