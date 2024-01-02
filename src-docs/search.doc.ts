import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'search',
  description: `Starts a search on shopify.dev.`,
  overviewPreviewDescription: 'Starts a search on shopify.dev.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'search',
          code: './examples/search.example.sh',
          language: 'bash',
        },
      ],
      title: 'search',
    },
  },
  definitions: [
    {
      title: 'search',
      description: 'The following flags are available for the `search` command:',
      type: 'search',
    },
  ],
  category: 'Commands',
  subCategory: 'common',
  related: [
  ],
}

export default data