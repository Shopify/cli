import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app env pull',
  description: `Pull app and extensions environment variables.`,
  overviewPreviewDescription: `Pull app and extensions environment variables.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app env pull',
          code: './examples/app-env-pull.example.sh',
          language: 'bash',
        },
      ],
      title: 'app env pull',
    },
  },
  definitions: [
    {
      title: 'app env pull',
      description: 'The following flags are available for the `app env pull` command:',
      type: 'appenvpull',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data