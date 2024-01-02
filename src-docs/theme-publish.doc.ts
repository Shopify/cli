import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme publish',
  description: `Set a remote theme as the live theme.`,
  overviewPreviewDescription: 'Set a remote theme as the live theme.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme publish',
          code: './examples/theme-publish.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme publish',
    },
  },
  definitions: [
    {
      title: 'theme publish',
      description: 'The following flags are available for the `theme publish` command:',
      type: 'themepublish',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data