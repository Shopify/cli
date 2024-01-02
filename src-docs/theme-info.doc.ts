import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme info',
  description: `Print basic information about your theme environment.`,
  overviewPreviewDescription: 'Print basic information about your theme environment.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme info',
          code: './examples/theme-info.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme info',
    },
  },
  definitions: [
    {
      title: 'theme info',
      description: 'The following flags are available for the `theme info` command:',
      type: 'themeinfo',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data