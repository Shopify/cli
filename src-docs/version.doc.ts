import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'version',
  description: `Shopify CLI version.`,
  overviewPreviewDescription: `Shopify CLI version.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'version',
          code: './examples/version.example.sh',
          language: 'bash',
        },
      ],
      title: 'version',
    },
  },
  definitions: [
    {
      title: 'version',
      description: 'The following flags are available for the `version` command:',
      type: 'version',
    },
  ],
  category: 'Commands',
  subCategory: 'common',
  related: [
  ],
}

export default data