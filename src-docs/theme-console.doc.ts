import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme console',
  description: `Shopify Liquid REPL (read-eval-print loop) tool`,
  overviewPreviewDescription: 'Shopify Liquid REPL (read-eval-print loop) tool',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme console',
          code: './examples/theme-console.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme console',
    },
  },
  definitions: [
    {
      title: 'theme console',
      description: 'The following flags are available for the `theme console` command:',
      type: 'themeconsole',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data