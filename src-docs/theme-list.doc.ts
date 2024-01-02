import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme list',
  description: `Lists your remote themes.`,
  overviewPreviewDescription: `Lists your remote themes.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme list',
          code: './examples/theme-list.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme list',
    },
  },
  definitions: [
    {
      title: 'theme list',
      description: 'The following flags are available for the `theme list` command:',
      type: 'themelist',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data