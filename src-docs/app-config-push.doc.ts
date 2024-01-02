import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app config push',
  description: `Push your app configuration to the Partner Dashboard.`,
  overviewPreviewDescription: `Push your app configuration to the Partner Dashboard.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app config push',
          code: './examples/app-config-push.example.sh',
          language: 'bash',
        },
      ],
      title: 'app config push',
    },
  },
  definitions: [
    {
      title: 'app config push',
      description: 'The following flags are available for the `app config push` command:',
      type: 'appconfigpush',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data