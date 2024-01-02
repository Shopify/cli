import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app release',
  description: `Release an app version.`,
  overviewPreviewDescription: 'Release an app version.',
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app release',
          code: './examples/app-release.example.sh',
          language: 'bash',
        },
      ],
      title: 'app release',
    },
  },
  definitions: [
    {
      title: 'app release',
      description: 'The following flags are available for the `app release` command:',
      type: 'apprelease',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data