import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme delete',
  description: `Delete remote themes from the connected store. This command can't be undone.`,
  overviewPreviewDescription: `Delete remote themes from the connected store. This command can't be undone.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme delete',
          code: './examples/theme-delete.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme delete',
    },
  },
  definitions: [
    {
      title: 'theme delete',
      description: 'The following flags are available for the `theme delete` command:',
      type: 'themedelete',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data