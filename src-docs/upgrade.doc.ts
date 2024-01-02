import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'upgrade',
  description: `Upgrade the Shopify CLI.`,
  overviewPreviewDescription: `Upgrade the Shopify CLI.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'upgrade',
          code: './examples/upgrade.example.sh',
          language: 'bash',
        },
      ],
      title: 'upgrade',
    },
  },
  definitions: [
    {
      title: 'upgrade',
      description: 'The following flags are available for the `upgrade` command:',
      type: 'upgrade',
    },
  ],
  category: 'Commands',
  subCategory: 'common',
  related: [
  ],
}

export default data