import {TemplateSpecification} from '../../app/template.js'
import {uiFlavors} from '../common.js'

/**
 * Web Pixel UI extension template specification.
 */
const webPixelUIExtension: TemplateSpecification = {
  identifier: 'web_pixel_extension',
  name: 'Web Pixel',
  group: 'Analytics',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'web_pixel_extension',
      extensionPoints: [],
      supportedFlavors: uiFlavors('packages/app/templates/ui-extensions/projects/web_pixel_extension'),
    },
  ],
}

export default webPixelUIExtension
