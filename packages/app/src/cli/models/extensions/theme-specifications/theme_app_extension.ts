import {createThemeExtensionSpec} from '../theme.js'
import {BaseThemeExtensionSchema} from '../schemas.js'

const spec = createThemeExtensionSpec({
  identifier: 'theme',
  externalIdentifier: 'theme_app_extension',
  partnersWebIdentifier: 'theme_app_extension',
  externalName: 'Theme app extension',
  graphQLType: 'theme_app_extension',
  schema: BaseThemeExtensionSchema,
})

export default spec
