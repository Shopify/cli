import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'config autocorrect on',
  description: `Enable autocorrect.  By default is on.`,
  overviewPreviewDescription: `Enable autocorrect.  By default is on.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'config autocorrect on',
          code: './examples/config-autocorrect-on.example.sh',
          language: 'bash',
        },
      ],
      title: 'config autocorrect on',
    },
  },
  definitions: [
    {
      title: 'config autocorrect on',
      description: 'The following flags are available for the `config autocorrect on` command:',
      type: 'configautocorrecton',
    },
  ],
  category: 'Commands',
  subCategory: 'config',
  related: [
  ],
}

export default data