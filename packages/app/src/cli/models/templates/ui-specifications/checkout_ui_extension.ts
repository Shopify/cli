import {TemplateSpecification} from '../../app/template.js'

/**
 * Checkout UI template specification.
 */
const checkoutUIExtension: TemplateSpecification = {
  identifier: 'checkout_ui_extension',
  name: 'Checkout UI',
  group: 'Discounts and checkout',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'checkout_ui_extension',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'TypeScript',
          value: 'typescript',
          path: 'packages/app/templates/ui-extensions/projects/checkout_ui_extension',
        },
        {
          name: 'JavaScript',
          value: 'vanilla-js',
          path: 'packages/app/templates/ui-extensions/projects/checkout_ui_extension',
        },
        {
          name: 'TypeScript React',
          value: 'typescript-react',
          path: 'packages/app/templates/ui-extensions/projects/checkout_ui_extension',
        },
        {
          name: 'JavaScript React',
          value: 'react',
          path: 'packages/app/templates/ui-extensions/projects/checkout_ui_extension',
        },
      ],
    },
  ],
}

export default checkoutUIExtension
