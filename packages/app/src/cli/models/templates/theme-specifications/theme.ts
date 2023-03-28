import {RemoteTemplateSpecification} from '../../../api/graphql/template_specifications.js'

/**
 * Theme App extension template specification.
 */
const themeSpecification: RemoteTemplateSpecification = {
  identifier: 'theme',
  name: 'Theme app extension',
  group: 'Online store',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli/packages/app/templates/theme-extension',
      type: 'theme',
      extensionPoints: [],
      supportedFlavors: [],
    },
  ],
}

export default themeSpecification
