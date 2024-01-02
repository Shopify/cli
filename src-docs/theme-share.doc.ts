import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme share',
  description: `Creates a shareable, unpublished, and new theme on your theme library with a randomized name. Works like an alias to \`shopify theme push -u -t=RANDOMIZED_NAME\`.`,
  overviewPreviewDescription: 'Creates a shareable, unpublished, and new theme on your theme library with a randomized name. Works like an alias to `shopify theme push -u -t=RANDOMIZED_NAME`.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme share',
          code: './examples/theme-share.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme share',
    },
  },
  definitions: [
    {
      title: 'theme share',
      description: 'The following flags are available for the `theme share` command:',
      type: 'themeshare',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data