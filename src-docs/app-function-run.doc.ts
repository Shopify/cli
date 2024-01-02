import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app function run',
  description: `Run a function locally for testing.`,
  overviewPreviewDescription: `Run a function locally for testing.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app function run',
          code: './examples/app-function-run.example.sh',
          language: 'bash',
        },
      ],
      title: 'app function run',
    },
  },
  definitions: [
    {
      title: 'app function run',
      description: 'The following flags are available for the `app function run` command:',
      type: 'appfunctionrun',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data