import {TemplateSpecification} from '../../app/template.js'

/**
 * Customer Accounts UI extension template specification.
 */
const customerAccountsUIExtension: TemplateSpecification = {
  identifier: 'customer_accounts_ui_extension',
  name: 'Customer Accounts',
  group: 'Shopify private',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'customer_accounts_ui_extension',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'TypeScript',
          value: 'typescript',
          path: 'packages/app/templates/ui-extensions/projects/customer_accounts_ui_extension',
        },
        {
          name: 'JavaScript',
          value: 'vanilla-js',
          path: 'packages/app/templates/ui-extensions/projects/customer_accounts_ui_extension',
        },
        {
          name: 'TypeScript React',
          value: 'typescript-react',
          path: 'packages/app/templates/ui-extensions/projects/customer_accounts_ui_extension',
        },
        {
          name: 'JavaScript React',
          value: 'react',
          path: 'packages/app/templates/ui-extensions/projects/customer_accounts_ui_extension',
        },
      ],
    },
  ],
}

export default customerAccountsUIExtension
