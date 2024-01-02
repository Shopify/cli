import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme check',
  description: `Validate the theme.`,
  overviewPreviewDescription: 'Validate the theme.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme check',
          code: './examples/theme-check.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme check',
    },
  },
  definitions: [
    {
      title: 'theme check',
      description: 'The following flags are available for the `theme check` command:',
      type: 'themecheck',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data