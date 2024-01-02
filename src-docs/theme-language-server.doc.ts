import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme language-server',
  description: `Start a Language Server Protocol server.`,
  overviewPreviewDescription: 'Start a Language Server Protocol server.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme language-server',
          code: './examples/theme-language-server.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme language-server',
    },
  },
  definitions: [
    {
      title: 'theme language-server',
      description: 'The following flags are available for the `theme language-server` command:',
      type: 'themelanguageserver',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data