import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'
import {ExtensionCategory} from '../../app/extensions.js'

const spec = createUIExtensionSpecification({
  identifier: 'theme',
  surface: 'admin',
  schema: BaseUIExtensionSchema,
  partnersWebIdentifier: 'theme_app_extension',
  graphQLType: 'theme_app_extension',
  category: (): ExtensionCategory => 'function',
})

export default spec
