import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'auth logout',
  description: `Logout from Shopify.`,
  overviewPreviewDescription: `Logout from Shopify.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'auth logout',
          code: './examples/auth-logout.example.sh',
          language: 'bash',
        },
      ],
      title: 'auth logout',
    },
  },
  definitions: [
    {
      title: 'auth logout',
      description: 'The following flags are available for the `auth logout` command:',
      type: 'authlogout',
    },
  ],
  category: 'Commands',
  subCategory: 'auth',
  related: [
  ],
}

export default data