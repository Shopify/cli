import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'config autocorrect status',
  description: `Check autocorrect current status. On by default.`,
  overviewPreviewDescription: 'Check autocorrect current status. On by default.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'config autocorrect status',
          code: './examples/config-autocorrect-status.example.sh',
          language: 'bash',
        },
      ],
      title: 'config autocorrect status',
    },
  },
  definitions: [
    {
      title: 'config autocorrect status',
      description: 'The following flags are available for the `config autocorrect status` command:',
      type: 'configautocorrectstatus',
    },
  ],
  category: 'Commands',
  subCategory: 'config',
  related: [
  ],
}

export default data