import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'

const spec = createExtensionSpecification({
  identifier: 'theme',
  surface: 'admin',
  schema: BaseSchema,
  partnersWebIdentifier: 'theme_app_extension',
  graphQLType: 'theme_app_extension',
  supportedFlavors: [],
  singleEntryPath: false,
  appModuleFeatures: (_) => {
    if (useThemebundling()) return ['bundling', 'theme']
    return ['theme']
  },
  previewMessage() {
    const link = outputToken.link(
      'dev doc instructions',
      'https://shopify.dev/apps/online-store/theme-app-extensions/getting-started#step-3-test-your-changes',
    )
    return outputContent`Follow the ${link} by deploying your work as a draft`
  },
  deployConfig: async () => {
    if (!useThemebundling()) return undefined
    return {theme_extension: {files: {}}}
  },
})

export default spec
