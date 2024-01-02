import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app build',
  description: `Build the app.`,
  overviewPreviewDescription: 'Build the app.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app build',
          code: './examples/app-build.example.sh',
          language: 'bash',
        },
      ],
      title: 'app build',
    },
  },
  definitions: [
    {
      title: 'app build',
      description: 'The following flags are available for the `app build` command:',
      type: 'appbuild',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data