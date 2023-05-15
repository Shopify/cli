import {TemplateSpecification} from '../../app/template.js'

/**
 * Product Subscription UI extension template specification.
 */
const productSubscriptionUIExtension: TemplateSpecification = {
  identifier: 'product_subscription',
  name: 'Subscription UI',
  group: 'Merchant admin',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'product_subscription',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'TypeScript',
          value: 'typescript',
          path: 'packages/app/templates/ui-extensions/projects/product_subscription',
        },
        {
          name: 'JavaScript',
          value: 'vanilla-js',
          path: 'packages/app/templates/ui-extensions/projects/product_subscription',
        },
        {
          name: 'TypeScript React',
          value: 'typescript-react',
          path: 'packages/app/templates/ui-extensions/projects/product_subscription',
        },
        {
          name: 'JavaScript React',
          value: 'react',
          path: 'packages/app/templates/ui-extensions/projects/product_subscription',
        },
      ],
    },
  ],
}

export default productSubscriptionUIExtension
