import {TemplateSpecification} from '../../app/template.js'

/**
 * Tax Calculation UI extension template specification.
 */
const taxCalculationUIExtension: TemplateSpecification = {
  identifier: 'tax_calculation',
  name: 'Tax Calculation',
  group: 'Merchant admin',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'tax_calculation',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'TypeScript',
          value: 'typescript',
          path: 'packages/app/templates/ui-extensions/projects/tax_calculation',
        },
        {
          name: 'JavaScript',
          value: 'vanilla-js',
          path: 'packages/app/templates/ui-extensions/projects/tax_calculation',
        },
        {
          name: 'TypeScript React',
          value: 'typescript-react',
          path: 'packages/app/templates/ui-extensions/projects/tax_calculation',
        },
        {
          name: 'JavaScript React',
          value: 'react',
          path: 'packages/app/templates/ui-extensions/projects/tax_calculation',
        },
      ],
    },
  ],
}

export default taxCalculationUIExtension
