import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app generate extension',
  description: `Scaffold an Extension.`,
  overviewPreviewDescription: `Scaffold an Extension.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app generate extension',
          code: './examples/app-generate-extension.example.sh',
          language: 'bash',
        },
      ],
      title: 'app generate extension',
    },
  },
  definitions: [
    {
      title: 'app generate extension',
      description: 'The following flags are available for the `app generate extension` command:',
      type: 'appgenerateextension',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data