import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme init',
  description: `Clones a Git repository to use as a starting point for building a new theme.`,
  overviewPreviewDescription: 'Clones a Git repository to use as a starting point for building a new theme.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme init',
          code: './examples/theme-init.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme init',
    },
  },
  definitions: [
    {
      title: 'theme init',
      description: 'The following flags are available for the `theme init` command:',
      type: 'themeinit',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data