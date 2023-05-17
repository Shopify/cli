import {ExtensionTemplate} from '../../app/template.js'

/**
 * Theme App extension template specification.
 */
const themeExtension: ExtensionTemplate = {
  identifier: 'theme',
  name: 'Theme app extension',
  group: 'Online store',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'theme',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'Liquid',
          value: 'liquid',
          path: 'packages/app/templates/theme-extension',
        },
      ],
    },
  ],
}

export default themeExtension
