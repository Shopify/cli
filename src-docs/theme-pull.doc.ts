import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme pull',
  description: `Download your remote theme files locally.`,
  overviewPreviewDescription: 'Download your remote theme files locally.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme pull',
          code: './examples/theme-pull.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme pull',
    },
  },
  definitions: [
    {
      title: 'theme pull',
      description: 'The following flags are available for the `theme pull` command:',
      type: 'themepull',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data