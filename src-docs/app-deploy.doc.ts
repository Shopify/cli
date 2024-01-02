import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app deploy',
  description: `Deploy your Shopify app.`,
  overviewPreviewDescription: `Deploy your Shopify app.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app deploy',
          code: './examples/app-deploy.example.sh',
          language: 'bash',
        },
      ],
      title: 'app deploy',
    },
  },
  definitions: [
    {
      title: 'app deploy',
      description: 'The following flags are available for the `app deploy` command:',
      type: 'appdeploy',
    },
  ],
  category: 'Commands',
  subCategory: 'app',
  related: [
  ],
}

export default data