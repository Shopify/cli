import {TemplateSpecification} from '../../app/template.js'

/**
 * UI extension template specification.
 */
const UIExtension: TemplateSpecification = {
  identifier: 'ui_extension',
  name: 'UI Extension',
  group: 'Shopify private',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'ui_extension',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'TypeScript',
          value: 'typescript',
          path: 'packages/app/templates/ui-extensions/projects/ui_extension',
        },
        {
          name: 'JavaScript',
          value: 'vanilla-js',
          path: 'packages/app/templates/ui-extensions/projects/ui_extension',
        },
        {
          name: 'TypeScript React',
          value: 'typescript-react',
          path: 'packages/app/templates/ui-extensions/projects/ui_extension',
        },
        {
          name: 'JavaScript React',
          value: 'react',
          path: 'packages/app/templates/ui-extensions/projects/ui_extension',
        },
      ],
    },
  ],
}

export default UIExtension
