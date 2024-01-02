import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme dev',
  description: `Uploads the current theme as a development theme to the connected store, then prints theme editor and preview URLs to your terminal. While running, changes will push to the store in real time.`,
  overviewPreviewDescription: `Uploads the current theme as a development theme to the connected store, then prints theme editor and preview URLs to your terminal. While running, changes will push to the store in real time.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme dev',
          code: './examples/theme-dev.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme dev',
    },
  },
  definitions: [
    {
      title: 'theme dev',
      description: 'The following flags are available for the `theme dev` command:',
      type: 'themedev',
    },
  ],
  category: 'Commands',
  subCategory: 'theme',
  related: [
  ],
}

export default data