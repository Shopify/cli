import {TemplateSpecification} from '../../app/template.js'

/**
 * POS UI template specification.
 */
const posUIExtension: TemplateSpecification = {
  identifier: 'pos_ui_extension',
  name: 'POS UI',
  group: 'Point-of-Sale',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'pos_ui_extension',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'TypeScript',
          value: 'typescript',
          path: 'packages/app/templates/ui-extensions/projects/pos_ui_extension',
        },
        {
          name: 'JavaScript',
          value: 'vanilla-js',
          path: 'packages/app/templates/ui-extensions/projects/pos_ui_extension',
        },
        {
          name: 'TypeScript React',
          value: 'typescript-react',
          path: 'packages/app/templates/ui-extensions/projects/pos_ui_extension',
        },
        {
          name: 'JavaScript React',
          value: 'react',
          path: 'packages/app/templates/ui-extensions/projects/pos_ui_extension',
        },
      ],
    },
  ],
}

export default posUIExtension
