import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app function typegen',
  description: `Generate GraphQL types for a JavaScript function.`,
  overviewPreviewDescription: 'Generate GraphQL types for a JavaScript function.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app function typegen',
          code: './examples/app-function-typegen.example.sh',
          language: 'bash',
        },
      ],
      title: 'app function typegen',
    },
  },
  definitions: [
    {
      title: 'app function typegen',
      description: 'The following flags are available for the `app function typegen` command:',
      type: 'appfunctiontypegen',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data