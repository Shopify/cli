import {ExtensionTemplate} from '../../app/template.js'

/**
 * Web Pixel UI extension template specification.
 */
const webPixelUIExtension: ExtensionTemplate = {
  identifier: 'web_pixel',
  name: 'Web pixel',
  defaultName: 'web-pixel',
  group: 'Analytics',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'web_pixel_extension',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'TypeScript',
          value: 'typescript',
          path: 'templates/ui-extensions/projects/web_pixel_extension',
        },
        {
          name: 'JavaScript',
          value: 'vanilla-js',
          path: 'templates/ui-extensions/projects/web_pixel_extension',
        },
      ],
    },
  ],
}

export default webPixelUIExtension
