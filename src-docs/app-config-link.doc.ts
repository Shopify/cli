import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app config link',
  description: `Fetch your app configuration from the Partner Dashboard.`,
  overviewPreviewDescription: 'Fetch your app configuration from the Partner Dashboard.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app config link',
          code: './examples/app-config-link.example.sh',
          language: 'bash',
        },
      ],
      title: 'app config link',
    },
  },
  definitions: [
    {
      title: 'app config link',
      description: 'The following flags are available for the `app config link` command:',
      type: 'appconfiglink',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data