import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app config use',
  description: `Activate an app configuration.`,
  overviewPreviewDescription: 'Activate an app configuration.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app config use',
          code: './examples/app-config-use.example.sh',
          language: 'bash',
        },
      ],
      title: 'app config use',
    },
  },
  definitions: [
    {
      title: 'app config use',
      description: 'The following flags are available for the `app config use` command:',
      type: 'appconfiguse',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data