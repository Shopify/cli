import {ThemeExtensionSchema} from '../schemas.js'
import {ThemeExtensionSpec} from '../theme.js'

/**
 * Extension specification with all properties and methods needed to load a theme extension.
 */
const themeSpecification: ThemeExtensionSpec = {
  identifier: 'theme',
  // these two fields are going to be overridden by the extension specification API response,
  // but we need them to have a default value for tests
  externalIdentifier: 'theme_external',
  externalName: 'Theme app extension',
  supportedFlavors: [],
  registrationLimit: 1,
  gated: false,
  category: () => 'theme' as const,
  partnersWebIdentifier: 'theme_app_extension',
  graphQLType: 'theme_app_extension',
  schema: ThemeExtensionSchema,
}

export default themeSpecification
