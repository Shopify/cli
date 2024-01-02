import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme push',
  description: `Uploads your local theme files to the connected store, overwriting the remote version if specified.`,
  overviewPreviewDescription: 'Uploads your local theme files to the connected store, overwriting the remote version if specified.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme push',
          code: './examples/theme-push.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme push',
    },
  },
  definitions: [
    {
      title: 'theme push',
      description: 'The following flags are available for the `theme push` command:',
      type: 'themepush',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data