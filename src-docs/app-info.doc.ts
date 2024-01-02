import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app info',
  description: `Print basic information about your app and extensions.`,
  overviewPreviewDescription: 'Print basic information about your app and extensions.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app info',
          code: './examples/app-info.example.sh',
          language: 'bash',
        },
      ],
      title: 'app info',
    },
  },
  definitions: [
    {
      title: 'app info',
      description: 'The following flags are available for the `app info` command:',
      type: 'appinfo',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data