import {RemoteTemplateSpecification} from '../../../api/graphql/template_specifications.js'

const dependency = {name: '@shopify/post-purchase-ui-extensions-react', version: '^0.13.2'}

/**
 * Post-purchase UI template specification.
 */
const checkoutPostPurchaseExtension: RemoteTemplateSpecification = {
  identifier: 'checkout_post_purchase',
  name: 'Post-purchase UI',
  group: 'Discounts and checkout',
  supportLinks: ['https://shopify.dev/docs/apps/checkout/post-purchase'],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'ui',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'TypeScript',
          value: 'typescript',
          path: 'packages/app/templates/ui-extensions/projects/checkout_post_purchase',
        },
        {
          name: 'JavaScript',
          value: 'vanilla-js',
          path: 'packages/app/templates/ui-extensions/projects/checkout_post_purchase',
        },
        {
          name: 'TypeScript React',
          value: 'typescript-react',
          path: 'packages/app/templates/ui-extensions/projects/checkout_post_purchase',
        },
        {
          name: 'JavaScript React',
          value: 'react',
          path: 'packages/app/templates/ui-extensions/projects/checkout_post_purchase',
        },
      ],
    },
  ],
}

export default checkoutPostPurchaseExtension
