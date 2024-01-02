import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app env show',
  description: `Display app and extensions environment variables.`,
  overviewPreviewDescription: 'Display app and extensions environment variables.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app env show',
          code: './examples/app-env-show.example.sh',
          language: 'bash',
        },
      ],
      title: 'app env show',
    },
  },
  definitions: [
    {
      title: 'app env show',
      description: 'The following flags are available for the `app env show` command:',
      type: 'appenvshow',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data