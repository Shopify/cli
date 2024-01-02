import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme package',
  description: `Package your theme into a .zip file, ready to upload to the Online Store.`,
  overviewPreviewDescription: `Package your theme into a .zip file, ready to upload to the Online Store.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme package',
          code: './examples/theme-package.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme package',
    },
  },
  definitions: [
    {
      title: 'theme package',
      description: 'The following flags are available for the `theme package` command:',
      type: 'themepackage',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data