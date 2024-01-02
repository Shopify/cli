import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'config autocorrect off',
  description: `Disable autocorrect.`,
  overviewPreviewDescription: `Disable autocorrect.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'config autocorrect off',
          code: './examples/config-autocorrect-off.example.sh',
          language: 'bash',
        },
      ],
      title: 'config autocorrect off',
    },
  },
  definitions: [
    {
      title: 'config autocorrect off',
      description: 'The following flags are available for the `config autocorrect off` command:',
      type: 'configautocorrectoff',
    },
  ],
  category: 'Commands',
  subCategory: 'config',
  related: [
  ],
}

export default data