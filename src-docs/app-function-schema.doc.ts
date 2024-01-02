import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app function schema',
  description: `Fetch the latest GraphQL schema for a function.`,
  overviewPreviewDescription: `Fetch the latest GraphQL schema for a function.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app function schema',
          code: './examples/app-function-schema.example.sh',
          language: 'bash',
        },
      ],
      title: 'app function schema',
    },
  },
  definitions: [
    {
      title: 'app function schema',
      description: 'The following flags are available for the `app function schema` command:',
      type: 'appfunctionschema',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data