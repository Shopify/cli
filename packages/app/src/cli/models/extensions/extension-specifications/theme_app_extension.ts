import {createExtensionSpec} from '../extensions.js'
import {BaseExtensionSchema} from '../schemas.js'

const spec = createExtensionSpec({
  identifier: 'theme',
  externalIdentifier: 'theme_app_extension',
  surface: 'unknown',
  graphQLType: 'theme_app_extension',
  partnersWebId: 'theme_app_extension',
  schema: BaseExtensionSchema,
})

export default spec
