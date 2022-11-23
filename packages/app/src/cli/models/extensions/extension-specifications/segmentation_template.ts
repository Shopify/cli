// import {getDependencyVersion} from '../../app/app.js'
import {createExtensionSpec} from '../extensions.js'
import {BaseExtensionSchema} from '../schemas.js'
// import {schema} from '@shopify/cli-kit'
// import {error} from '@shopify/cli-kit'

const dependency = {name: '@shopify/admin-ui-extensions-react', version: '^1.0.1'}

const spec = createExtensionSpec({
  identifier: 'segmentation_template',
  externalIdentifier: 'segmentation_template',
  surface: 'admin',
  dependency,
  partnersWebId: 'segmentation_template',
  schema: BaseExtensionSchema,
  deployConfig: async (config) => {
    return {
      extension_points: config.extensionPoints,
      name: config.name,
    }
  },
})

export default spec
