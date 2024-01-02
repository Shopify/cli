import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme open',
  description: `Opens the preview of your remote theme.`,
  overviewPreviewDescription: 'Opens the preview of your remote theme.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme open',
          code: './examples/theme-open.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme open',
    },
  },
  definitions: [
    {
      title: 'theme open',
      description: 'The following flags are available for the `theme open` command:',
      type: 'themeopen',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data