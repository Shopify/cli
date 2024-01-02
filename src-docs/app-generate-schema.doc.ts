import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app generate schema',
  description: `Fetch the latest GraphQL schema for a function.`,
  overviewPreviewDescription: 'Fetch the latest GraphQL schema for a function.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app generate schema',
          code: './examples/app-generate-schema.example.sh',
          language: 'bash',
        },
      ],
      title: 'app generate schema',
    },
  },
  definitions: [
    {
      title: 'app generate schema',
      description: 'The following flags are available for the `app generate schema` command:',
      type: 'appgenerateschema',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data