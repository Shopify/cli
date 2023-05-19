import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

const spec = createExtensionSpecification({
  identifier: 'theme',
  surface: 'admin',
  schema: BaseSchema,
  partnersWebIdentifier: 'theme_app_extension',
  graphQLType: 'theme_app_extension',
  supportedFlavors: [],
  singleEntryPath: false,
  appModuleFeatures: (_) => ['theme'],
  previewMessage() {
    const link = outputToken.link(
      'dev doc instructions',
      'https://shopify.dev/apps/online-store/theme-app-extensions/getting-started#step-3-test-your-changes',
    )
    return outputContent`Follow the ${link} by deploying your work as a draft`
  },
})

export default spec
