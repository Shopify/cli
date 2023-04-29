import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'

const spec = createUIExtensionSpecification({
  identifier: 'theme',
  surface: 'admin',
  schema: BaseUIExtensionSchema,
  partnersWebIdentifier: 'theme_app_extension',
  graphQLType: 'theme_app_extension',
})

export default spec
