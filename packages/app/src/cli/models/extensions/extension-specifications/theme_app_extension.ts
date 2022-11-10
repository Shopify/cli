import {createExtensionSpec} from '../extensions.js'
import {BaseExtensionSchema} from '../schemas.js'
import {output} from '@shopify/cli-kit'

const spec = createExtensionSpec({
  identifier: 'theme',
  externalIdentifier: 'theme_app_extension',
  externalName: 'Theme app extension',
  surface: 'unknown',
  graphQLType: 'theme_app_extension',
  partnersWebId: 'theme_app_extension',
  schema: BaseExtensionSchema,
  previewMessage(_) {
    const link = output.token.link(
      'dev doc instructions',
      'https://shopify.dev/apps/online-store/theme-app-extensions/getting-started#step-3-test-your-changes',
    )
    return output.content`Follow the ${link} by deployiqng your work as a draft`.value
  },
})

export default spec
