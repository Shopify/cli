import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app update-url',
  description: `Update your app and redirect URLs in the Partners Dashboard.`,
  overviewPreviewDescription: `Update your app and redirect URLs in the Partners Dashboard.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app update-url',
          code: './examples/app-update-url.example.sh',
          language: 'bash',
        },
      ],
      title: 'app update-url',
    },
  },
  definitions: [
    {
      title: 'app update-url',
      description: 'The following flags are available for the `app update-url` command:',
      type: 'appupdateurl',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data