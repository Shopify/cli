import {ExtensionTemplate} from '../../app/template.js'

/**
 * Theme App extension template specification.
 */
const themeExtension: ExtensionTemplate = {
  identifier: 'theme_app_extension',
  name: 'Theme app extension',
  defaultName: 'theme-extension',
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
          path: 'templates/theme-extension',
        },
      ],
    },
  ],
}

export default themeExtension
